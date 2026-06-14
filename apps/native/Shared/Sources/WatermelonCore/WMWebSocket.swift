import Foundation

public enum WMWebSocketEvent: Sendable {
    case connected
    case message(WMMessage)
    case typing(chatId: String, userId: String, isTyping: Bool)
    case error(String)
    case disconnected
}

/// WebSocket-клиент для realtime сообщений (URLSessionWebSocketTask).
@MainActor
public final class WMWebSocket: ObservableObject {
    public private(set) var isConnected = false

    private let wsURL: URL
    private let token: String
    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    private var onEvent: ((WMWebSocketEvent) -> Void)?

    public init(wsURL: URL, token: String) {
        self.wsURL = wsURL
        self.token = token
    }

    public func connect(onEvent: @escaping (WMWebSocketEvent) -> Void) {
        self.onEvent = onEvent
        disconnect()
        let session = URLSession(configuration: .default)
        self.session = session
        let task = session.webSocketTask(with: wsURL)
        self.task = task
        task.resume()
        sendJSON(["type": "auth", "token": token])
        receiveLoop()
        isConnected = true
        onEvent(.connected)
    }

    public func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        session = nil
        isConnected = false
        onEvent?(.disconnected)
    }

    public func subscribe(chatId: String) {
        sendJSON(["type": "subscribe", "chatId": chatId])
    }

    public func sendMessage(chatId: String, content: String) {
        sendJSON(["type": "message", "chatId": chatId, "content": content, "messageType": "text"])
    }

    private func sendJSON(_ obj: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: obj),
              let text = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(text)) { [weak self] err in
            if let err { self?.onEvent?(.error(err.localizedDescription)) }
        }
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let msg):
                if case .string(let text) = msg {
                    Task { @MainActor in self.handle(text) }
                }
                Task { @MainActor in self.receiveLoop() }
            case .failure(let err):
                Task { @MainActor in
                    self.isConnected = false
                    self.onEvent?(.error(err.localizedDescription))
                    self.onEvent?(.disconnected)
                }
            }
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }

        switch type {
        case "message":
            if let msgObj = json["message"] as? [String: Any],
               let msgData = try? JSONSerialization.data(withJSONObject: msgObj),
               let msg = try? JSONDecoder().decode(WMMessage.self, from: msgData) {
                onEvent?(.message(msg))
            }
        case "typing":
            if let chatId = json["chatId"] as? String,
               let userId = json["userId"] as? String,
               let isTyping = json["isTyping"] as? Bool {
                onEvent?(.typing(chatId: chatId, userId: userId, isTyping: isTyping))
            }
        case "error":
            onEvent?(.error((json["error"] as? String) ?? "Unknown error"))
        default:
            break
        }
    }
}

import SwiftUI
import WatermelonCore

#if canImport(UIKit)
import UIKit
#endif

@main
struct WatermelonIOSApp: App {
    @StateObject private var session = WMSessionStore(apiBase: WMConfig.apiBase)

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .onAppear { configureYandexAnchor() }
        }
    }

    private func configureYandexAnchor() {
        #if canImport(UIKit)
        if let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) {
            WMYandexAuth.shared.setPresentationAnchor(window)
        }
        #endif
    }
}

enum WMConfig {
    static var apiBase: URL {
        if let env = ProcessInfo.processInfo.environment["WM_API_BASE"],
           let url = URL(string: env) { return url }
        return URL(string: "http://localhost:8080/api")!
    }

    static var wsBase: URL {
        if let env = ProcessInfo.processInfo.environment["WM_WS_BASE"],
           let url = URL(string: env) { return url }
        return URL(string: "ws://localhost:8080/ws")!
    }
}

struct RootView: View {
    @EnvironmentObject var session: WMSessionStore

    var body: some View {
        Group {
            if session.token == nil {
                LoginView()
            } else if !session.isBetaApproved {
                BetaPendingView()
            } else {
                ChatListView()
            }
        }
        .task {
            if session.token != nil {
                await session.refreshMe()
            }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var session: WMSessionStore
    @State private var loading = false

    var body: some View {
        VStack(spacing: 24) {
            Text("🍉").font(.system(size: 72))
            Text("Watermelon").font(.largeTitle.bold())
            Text("Войдите через Яндекс ID")
                .foregroundStyle(.secondary)

            if let err = session.authError {
                Text(err).font(.caption).foregroundStyle(.red).multilineTextAlignment(.center)
            }

            Button {
                loading = true
                Task {
                    await session.loginWithYandex()
                    loading = false
                }
            } label: {
                HStack(spacing: 10) {
                    if loading {
                        ProgressView().tint(.white)
                    } else {
                        Text("Я").font(.headline.bold())
                            .frame(width: 28, height: 28)
                            .background(Color.red)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        Text("Войти через Яндекс ID")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .disabled(loading)
        }
        .padding(32)
    }
}

struct BetaPendingView: View {
    @EnvironmentObject var session: WMSessionStore

    var body: some View {
        VStack(spacing: 16) {
            Text("🍉").font(.system(size: 56))
            Text("Ожидание beta-доступа").font(.title2.bold())
            Text("Привет, \(session.user?.username ?? "друг")! Администратор откроет доступ — приложение обновится автоматически.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            ProgressView()
            Button("Обновить") {
                Task { await session.refreshMe() }
            }
            Button("Выйти", role: .destructive) {
                session.logout()
            }
        }
        .padding()
        .task {
            while !Task.isCancelled, session.token != nil, !session.isBetaApproved {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                await session.refreshMe()
            }
        }
    }
}

struct ChatListView: View {
    @EnvironmentObject var session: WMSessionStore
    @State private var chats: [WMChat] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Загрузка чатов…")
                } else if let error {
                    ContentUnavailableView("Ошибка", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if chats.isEmpty {
                    ContentUnavailableView("Нет чатов", systemImage: "bubble.left.and.bubble.right", description: Text("Создайте чат в веб-клиенте"))
                } else {
                    List(chats, id: \.id) { chat in
                        NavigationLink(value: chat.id) {
                            ChatRow(chat: chat, userId: session.user?.id)
                        }
                    }
                }
            }
            .navigationTitle(session.user?.username ?? "Watermelon")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Выйти") { session.logout() }
                }
            }
            .navigationDestination(for: String.self) { chatId in
                ChatDetailView(chatId: chatId)
            }
            .refreshable { await loadChats() }
        }
        .task { await loadChats() }
    }

    func loadChats() async {
        guard let api = session.api else { return }
        loading = true
        error = nil
        do {
            chats = try await api.fetchChats()
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

struct ChatRow: View {
    let chat: WMChat
    let userId: String?

    var title: String {
        if chat.type == "group" { return chat.name ?? "Группа" }
        return chat.members?.first(where: { $0.id != userId })?.username ?? "Чат"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.headline)
            if let preview = chat.lastMessagePreview, !preview.isEmpty {
                Text(preview).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }
}

struct ChatDetailView: View {
    let chatId: String
    @EnvironmentObject var session: WMSessionStore
    @StateObject private var wsHolder = WSHolder()
    @State private var messages: [WMMessage] = []
    @State private var loading = true
    @State private var input = ""

    var body: some View {
        VStack(spacing: 0) {
            if loading {
                ProgressView().frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(messages, id: \.id) { msg in
                            MessageBubble(message: msg, isOwn: msg.senderId == session.user?.id)
                        }
                    }
                    .padding()
                }
            }
            HStack {
                TextField("Сообщение", text: $input).textFieldStyle(.roundedBorder)
                Button("→") {
                    let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { return }
                    wsHolder.socket?.sendMessage(chatId: chatId, content: text)
                    input = ""
                }
            }
            .padding()
        }
        .navigationTitle("Чат")
        .task {
            await loadMessages()
            connectWS()
        }
        .onDisappear { wsHolder.socket?.disconnect() }
    }

    func loadMessages() async {
        guard let api = session.api else { return }
        loading = true
        do { messages = try await api.fetchMessages(chatId: chatId) } catch {}
        loading = false
    }

    func connectWS() {
        guard let token = session.token else { return }
        let socket = WMWebSocket(wsURL: WMConfig.wsBase, token: token)
        wsHolder.socket = socket
        socket.connect { event in
            if case .message(let msg) = event, msg.chatId == chatId,
               !messages.contains(where: { $0.id == msg.id }) {
                messages.append(msg)
            }
        }
        socket.subscribe(chatId: chatId)
    }
}

@MainActor
final class WSHolder: ObservableObject {
    var socket: WMWebSocket?
}

struct MessageBubble: View {
    let message: WMMessage
    let isOwn: Bool

    var body: some View {
        HStack {
            if isOwn { Spacer(minLength: 40) }
            Text(message.content)
                .padding(10)
                .background(isOwn ? Color.red.opacity(0.85) : Color.gray.opacity(0.25))
                .foregroundStyle(isOwn ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            if !isOwn { Spacer(minLength: 40) }
        }
    }
}

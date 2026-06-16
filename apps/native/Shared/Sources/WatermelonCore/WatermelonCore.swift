import Foundation
import Combine

public struct WMUser: Codable, Sendable {
    public let id: String
    public let email: String?
    public let username: String
    public let avatarUrl: String?
    public let coverUrl: String?
    public let bio: String?
    public let subscriptionTier: String?
    public let betaApproved: Bool?
    public let isAdmin: Bool?
    public let createdAt: String?
}

public struct WMYandexAuthorizeStart: Codable, Sendable {
    public let authorizeUrl: String
    public let redirectUri: String
    public let state: String
}

public struct WMAuthExchangeResponse: Codable, Sendable {
    public let token: String
    public let user: WMUser
}

public struct WMChatMember: Codable, Sendable {
    public let id: String
    public let username: String
    public let avatarUrl: String?
    public let role: String
}

public struct WMChat: Codable, Sendable {
    public let id: String
    public let type: String
    public let name: String?
    public let avatarUrl: String?
    public let createdAt: String
    public let lastMessageAt: String?
    public let lastMessagePreview: String?
    public let members: [WMChatMember]?
}

public struct WMMessage: Codable, Sendable {
    public let id: String
    public let chatId: String
    public let senderId: String
    public let content: String
    public let createdAt: String
    public let messageType: String?
    public let attachmentUrl: String?
}

public enum WatermelonAPIError: Error, Sendable {
    case unauthorized
    case http(Int)
    case decode
}

/// API-клиент для iOS/macOS. JWT после Yandex OAuth.
public final class WatermelonAPI: Sendable {
    public let baseURL: URL
    private let token: String

    public init(baseURL: URL, token: String = "") {
        self.baseURL = baseURL
        self.token = token
    }

    private func request(path: String, method: String = "GET", body: Data? = nil, auth: Bool = true) async throws -> Data {
        var req = URLRequest(url: baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        req.httpMethod = method
        if auth, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if body != nil {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = body
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw WatermelonAPIError.decode }
        if http.statusCode == 401 { throw WatermelonAPIError.unauthorized }
        guard (200...299).contains(http.statusCode) else { throw WatermelonAPIError.http(http.statusCode) }
        return data
    }

    public func fetchOAuthConfig() async throws -> WMOAuthConfig {
        let data = try await request(path: "auth/yandex/config", auth: false)
        return try JSONDecoder().decode(WMOAuthConfig.self, from: data)
    }

    public func fetchYandexAuthorizeURL(redirectUri: String) async throws -> WMYandexAuthorizeStart {
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/yandex"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "platform", value: "native"),
            URLQueryItem(name: "redirect_uri", value: redirectUri),
        ]
        var req = URLRequest(url: components.url!)
        req.httpMethod = "GET"
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw WatermelonAPIError.http((resp as? HTTPURLResponse)?.statusCode ?? 0)
        }
        return try JSONDecoder().decode(WMYandexAuthorizeStart.self, from: data)
    }

    public func exchangeYandexCode(code: String, redirectUri: String, state: String?) async throws -> WMAuthExchangeResponse {
        var payload: [String: String] = ["code": code, "redirect_uri": redirectUri]
        if let state { payload["state"] = state }
        let body = try JSONEncoder().encode(payload)
        let data = try await request(path: "auth/yandex/exchange", method: "POST", body: body, auth: false)
        return try JSONDecoder().decode(WMAuthExchangeResponse.self, from: data)
    }

    public func fetchMe() async throws -> WMUser {
        let data = try await request(path: "auth/me")
        return try JSONDecoder().decode(WMUser.self, from: data)
    }

    public func fetchChats() async throws -> [WMChat] {
        let data = try await request(path: "chats")
        return try JSONDecoder().decode([WMChat].self, from: data)
    }

    public func fetchMessages(chatId: String, limit: Int = 50) async throws -> [WMMessage] {
        let data = try await request(path: "chats/\(chatId)/messages?limit=\(limit)")
        struct Wrap: Decodable { let messages: [WMMessage] }
        return try JSONDecoder().decode(Wrap.self, from: data).messages
    }

    public func yandexAuthURL(redirectUri: String? = nil) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/yandex"), resolvingAgainstBaseURL: false)!
        if let redirectUri {
            components.queryItems = [URLQueryItem(name: "redirect_uri", value: redirectUri)]
        }
        return components.url!
    }
}

/// Хранит JWT локально (UserDefaults).
public final class WMSessionStore: ObservableObject, @unchecked Sendable {
    @Published public private(set) var token: String?
    @Published public private(set) var user: WMUser?
    @Published public var authError: String?

    private let tokenKey = "wm_native_token"
    private let userKey = "wm_native_user"
    public let apiBase: URL

    public init(apiBase: URL) {
        self.apiBase = apiBase
        self.token = UserDefaults.standard.string(forKey: tokenKey)
        if let data = UserDefaults.standard.data(forKey: userKey),
           let u = try? JSONDecoder().decode(WMUser.self, from: data) {
            self.user = u
        }
    }

    public var api: WatermelonAPI? {
        guard let token, !token.isEmpty else { return nil }
        return WatermelonAPI(baseURL: apiBase, token: token)
    }

    public var isBetaApproved: Bool {
        user?.betaApproved ?? false
    }

    public func setSession(token: String, user: WMUser) {
        self.token = token
        self.user = user
        UserDefaults.standard.set(token, forKey: tokenKey)
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
    }

    public func setToken(_ token: String) {
        self.token = token
        UserDefaults.standard.set(token, forKey: tokenKey)
    }

    public func loginWithYandex() async {
        authError = nil
        do {
            let result = try await WMYandexAuth.shared.signIn(apiBase: apiBase)
            setSession(token: result.token, user: result.user)
        } catch WMYandexAuthError.cancelled {
            return
        } catch {
            authError = error.localizedDescription
        }
    }

    public func logout() {
        token = nil
        user = nil
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: userKey)
    }

    public func refreshMe() async {
        guard let api else { return }
        do {
            let u = try await api.fetchMe()
            user = u
            if let data = try? JSONEncoder().encode(u) {
                UserDefaults.standard.set(data, forKey: userKey)
            }
        } catch {
            logout()
        }
    }
}

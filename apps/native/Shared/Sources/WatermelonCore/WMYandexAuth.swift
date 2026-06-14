import Foundation
import AuthenticationServices

public struct WMOAuthConfig: Codable, Sendable {
    public let clientId: String?
    public let webRedirectUri: String
    public let nativeRedirectUri: String
    public let configured: Bool
}

public struct WMAuthResult: Sendable {
    public let token: String
    public let user: WMUser
}

public enum WMYandexAuthError: Error, Sendable {
    case notConfigured
    case cancelled
    case noCode
    case exchangeFailed
}

/// Полноценная авторизация через Yandex ID (ASWebAuthenticationSession).
@MainActor
public final class WMYandexAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    public static let shared = WMYandexAuth()

    private var authSession: ASWebAuthenticationSession?
    private weak var anchorWindow: ASPresentationAnchor?

    public func setPresentationAnchor(_ window: ASPresentationAnchor) {
        anchorWindow = window
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchorWindow ?? ASPresentationAnchor()
    }

    /// Вход через Yandex OAuth: браузер → callback URL → обмен code на JWT.
    public func signIn(apiBase: URL, redirectURI: String? = nil) async throws -> WMAuthResult {
        let api = WatermelonAPI(baseURL: apiBase, token: "")
        let config = try await api.fetchOAuthConfig()
        guard config.configured, config.clientId != nil else {
            throw WMYandexAuthError.notConfigured
        }

        let redirect = redirectURI ?? config.nativeRedirectUri
        guard let scheme = URL(string: redirect)?.scheme, !scheme.isEmpty else {
            throw WMYandexAuthError.notConfigured
        }

        let start = try await api.fetchYandexAuthorizeURL(redirectUri: redirect)
        let callbackURL = try await openAuthSession(url: start.authorizeUrl, callbackScheme: scheme)
        guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "code" })?
            .value else {
            throw WMYandexAuthError.noCode
        }

        let exchanged = try await api.exchangeYandexCode(
            code: code,
            redirectUri: redirect,
            state: start.state
        )
        return WMAuthResult(token: exchanged.token, user: exchanged.user)
    }

    private func openAuthSession(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { [weak self] url, error in
                self?.authSession = nil
                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin {
                    cont.resume(throwing: WMYandexAuthError.cancelled)
                    return
                }
                if let error {
                    cont.resume(throwing: error)
                    return
                }
                guard let url else {
                    cont.resume(throwing: WMYandexAuthError.noCode)
                    return
                }
                cont.resume(returning: url)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            if !session.start() {
                cont.resume(throwing: WMYandexAuthError.notConfigured)
            }
        }
    }
}

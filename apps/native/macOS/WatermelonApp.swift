import AppKit
import SwiftUI
import WatermelonCore

@main
struct WatermelonMacApp: App {
    @StateObject private var session = WMSessionStore(apiBase: WMConfig.apiBase)

    var body: some Scene {
        WindowGroup {
            MacRootView()
                .environmentObject(session)
                .frame(minWidth: 900, minHeight: 640)
                .onAppear {
                    if let window = NSApplication.shared.windows.first {
                        WMYandexAuth.shared.setPresentationAnchor(window)
                    }
                }
        }
        .windowStyle(.hiddenTitleBar)
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

struct MacRootView: View {
    @EnvironmentObject var session: WMSessionStore

    var body: some View {
        Group {
            if session.token == nil {
                MacLoginView()
            } else if !session.isBetaApproved {
                MacBetaPendingView()
            } else {
                MacChatListView()
            }
        }
        .task {
            if session.token != nil { await session.refreshMe() }
        }
    }
}

struct MacLoginView: View {
    @EnvironmentObject var session: WMSessionStore
    @State private var loading = false

    var body: some View {
        VStack(spacing: 20) {
            Text("🍉 Watermelon").font(.largeTitle.bold())
            Text("Войдите через Яндекс ID").foregroundStyle(.secondary)
            if let err = session.authError {
                Text(err).foregroundStyle(.red).font(.caption)
            }
            Button {
                loading = true
                Task {
                    await session.loginWithYandex()
                    loading = false
                }
            } label: {
                HStack {
                    if loading { ProgressView() }
                    Text("Войти через Яндекс ID")
                }
            }
            .disabled(loading)
        }
        .padding(40)
    }
}

struct MacBetaPendingView: View {
    @EnvironmentObject var session: WMSessionStore

    var body: some View {
        VStack(spacing: 12) {
            Text("Ожидание beta-доступа").font(.title2)
            Text("Администратор откроет доступ. Статус обновляется каждые 5 секунд.")
                .foregroundStyle(.secondary)
            ProgressView()
            Button("Выйти") { session.logout() }
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

struct MacChatListView: View {
    @EnvironmentObject var session: WMSessionStore
    @State private var chats: [WMChat] = []
    @State private var selectedChatId: String?

    var body: some View {
        NavigationSplitView {
            List(chats, id: \.id, selection: $selectedChatId) { chat in
                Text(chat.name ?? chat.lastMessagePreview ?? chat.id).tag(chat.id as String?)
            }
            .navigationTitle(session.user?.username ?? "Watermelon")
            .toolbar {
                Button("Выйти") { session.logout() }
            }
            .task {
                guard let api = session.api else { return }
                chats = (try? await api.fetchChats()) ?? []
            }
        } detail: {
            if let id = selectedChatId {
                Text("Чат \(id)").foregroundStyle(.secondary)
            } else {
                Text("Выберите чат").foregroundStyle(.secondary)
            }
        }
    }
}

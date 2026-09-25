import Foundation

/// Why one HTTP read did not produce a displayable value.
enum WebUIFailure: Equatable {
    /// The loopback service could not be reached.
    case unreachable
    /// The service answered with a redirect, which is never followed or used.
    case redirected
    /// The service answered with an unexpected status code.
    case status(code: Int)
    /// The response body did not match the current Core JSON output.
    case decoding
    /// The origin is not the confirmed loopback address.
    case invalidOrigin
}

enum WebUIReadResult<Value>: Equatable where Value: Equatable {
    case value(Value)
    /// HTTP 404 means the selected Task is unavailable; it is not a service
    /// disconnect.
    case notFound
    case failure(WebUIFailure)
}

protocol WebUIReading {
    var origin: String { get }
    func systemStatus() async -> WebUIReadResult<SystemStatusResponse>
    func taskList(page: Int, lifecycle: TaskLifecycle?) async -> WebUIReadResult<TaskListResponse>
    func taskDetail(taskID: String) async -> WebUIReadResult<TaskDetailResponse>
}

/// Reads the confirmed loopback origin over the system HTTP client. Redirects
/// are disabled and one request waits at most three seconds.
final class LoopbackWebUIClient: WebUIReading {
    /// One HTTP read waits at most three seconds.
    static let requestTimeout: TimeInterval = 3

    let origin: String
    private let session: URLSession

    init?(origin: String) {
        guard LoopbackWebUIClient.isConfirmedLoopbackOrigin(origin) else { return nil }
        self.origin = origin
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = Self.requestTimeout
        configuration.timeoutIntervalForResource = Self.requestTimeout
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.httpShouldUsePipelining = false
        session = URLSession(configuration: configuration)
    }

    /// Only `http://127.0.0.1:<port>` is accepted, so a changed or foreign
    /// address cannot be used for reads or navigation.
    static func isConfirmedLoopbackOrigin(_ value: String) -> Bool {
        guard value.hasPrefix("http://127.0.0.1:") else { return false }
        let port = value.dropFirst("http://127.0.0.1:".count)
        guard !port.isEmpty, port.allSatisfy(\.isASCII), port.allSatisfy({ $0.isNumber }) else { return false }
        guard let number = Int(port), number > 0, number <= 65535 else { return false }
        return true
    }

    func systemStatus() async -> WebUIReadResult<SystemStatusResponse> {
        await read(path: "/api/system/status") { data in
            try WebUIDecoding.decodeSystemStatus(data)
        }
    }

    func taskList(page: Int, lifecycle: TaskLifecycle?) async -> WebUIReadResult<TaskListResponse> {
        var items: [URLQueryItem] = [URLQueryItem(name: "page", value: String(max(page, 1)))]
        if let lifecycle, lifecycle != .unknown {
            items.append(URLQueryItem(name: "lifecycle", value: lifecycle.rawValue))
        }
        return await read(path: "/api/tasks", queryItems: items) { data in
            try WebUIDecoding.decodeTaskList(data)
        }
    }

    func taskDetail(taskID: String) async -> WebUIReadResult<TaskDetailResponse> {
        guard let segment = LoopbackWebUIClient.pathSegment(taskID) else {
            return .failure(.invalidOrigin)
        }
        return await read(path: "/api/tasks/\(segment)") { data in
            try WebUIDecoding.decodeTaskDetail(data)
        }
    }

    /// Encodes a Task identifier as exactly one path segment. Reserved
    /// characters, including `/`, are percent-encoded so a Task identifier can
    /// never widen the request path.
    static func pathSegment(_ value: String) -> String? {
        guard !value.isEmpty else { return nil }
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed)
    }

    private func read<Value: Equatable>(
        path: String,
        queryItems: [URLQueryItem]? = nil,
        decode: @escaping (Data) throws -> Value
    ) async -> WebUIReadResult<Value> {
        guard var components = URLComponents(string: origin) else { return .failure(.invalidOrigin) }
        components.percentEncodedPath = path
        if let queryItems {
            components.queryItems = queryItems
        }
        guard let url = components.url else { return .failure(.invalidOrigin) }
        var request = URLRequest(url: url, timeoutInterval: Self.requestTimeout)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let redirectBlocker = RedirectBlocker()
        do {
            let (data, response) = try await session.data(for: request, delegate: redirectBlocker)
            if redirectBlocker.wasRedirected { return .failure(.redirected) }
            guard let http = response as? HTTPURLResponse else { return .failure(.unreachable) }
            switch http.statusCode {
            case 200:
                guard let value = try? decode(data) else { return .failure(.decoding) }
                return .value(value)
            case 404:
                return .notFound
            default:
                return .failure(.status(code: http.statusCode))
            }
        } catch is CancellationError {
            return .failure(.unreachable)
        } catch {
            return .failure(.unreachable)
        }
    }

    /// Refuses every redirect and records that one was offered.
    private final class RedirectBlocker: NSObject, URLSessionTaskDelegate {
        private(set) var wasRedirected = false

        func urlSession(
            _ session: URLSession,
            task: URLSessionTask,
            willPerformHTTPRedirection response: HTTPURLResponse,
            newRequest request: URLRequest,
            completionHandler: @escaping (URLRequest?) -> Void
        ) {
            wasRedirected = true
            completionHandler(nil)
        }
    }
}

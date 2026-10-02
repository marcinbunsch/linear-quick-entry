// Exports one signing identity (certificate + private key) from the keychain as a .p12.
// `security export -t identities` exports every identity in the keychain; this exports only the named one.
// Usage: EXPORT_PASSWORD=… swift scripts/export-identity.swift "Developer ID Application: Name (TEAMID)" out.p12
import Foundation
import Security

let arguments = CommandLine.arguments
guard arguments.count == 3, let password = ProcessInfo.processInfo.environment["EXPORT_PASSWORD"], !password.isEmpty else {
    FileHandle.standardError.write(Data("usage: EXPORT_PASSWORD=… swift export-identity.swift <identity name> <output.p12>\n".utf8))
    exit(2)
}
let identityName = arguments[1]
let outputPath = arguments[2]

func fail(_ message: String, _ status: OSStatus) -> Never {
    let reason = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus \(status)"
    FileHandle.standardError.write(Data("\(message): \(reason)\n".utf8))
    exit(1)
}

let query: [String: Any] = [
    kSecClass as String: kSecClassIdentity,
    kSecMatchLimit as String: kSecMatchLimitAll,
    kSecReturnRef as String: true,
]
var found: CFTypeRef?
let searchStatus = SecItemCopyMatching(query as CFDictionary, &found)
guard searchStatus == errSecSuccess, let identities = found as? [SecIdentity] else { fail("No identities found", searchStatus) }

let match = identities.first { identity in
    var certificate: SecCertificate?
    guard SecIdentityCopyCertificate(identity, &certificate) == errSecSuccess, let certificate else { return false }
    return SecCertificateCopySubjectSummary(certificate) as String? == identityName
}
guard let match else { fail("No identity named \"\(identityName)\"", errSecItemNotFound) }

var parameters = SecItemImportExportKeyParameters()
parameters.version = UInt32(SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION)
parameters.passphrase = Unmanaged.passRetained(password as CFString)
var exported: CFData?
// macOS asks for the login keychain password here, to release the private key.
let exportStatus = SecItemExport(match, .formatPKCS12, [], &parameters, &exported)
guard exportStatus == errSecSuccess, let exported else { fail("Export failed", exportStatus) }

do {
    try (exported as Data).write(to: URL(fileURLWithPath: outputPath), options: .atomic)
} catch {
    FileHandle.standardError.write(Data("Couldn't write \(outputPath): \(error.localizedDescription)\n".utf8))
    exit(1)
}

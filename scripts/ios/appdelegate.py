# O modelo do Capacitor não repassa o token de notificação (APNs) ao plugin.
# Acrescenta os dois métodos que faltam no AppDelegate. Uso: python3 appdelegate.py <AppDelegate.swift>
import sys
p = sys.argv[1]
s = open(p).read()
if "capacitorDidRegisterForRemoteNotifications" not in s:
    add = """
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
"""
    i = s.rstrip().rfind("}")
    s = s[:i].rstrip() + "\n" + add
    open(p, "w").write(s)
print(open(p).read())

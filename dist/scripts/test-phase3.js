import "dotenv/config";
async function testPhase3() {
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "jeanregis@bimelink.io",
            password: "Admin123!",
        }),
    });
    const loginData = await loginRes.json();
    console.log("Login success:", loginData.success);
    const token = loginData.token;
    // 1. Get Lists
    const listsRes = await fetch("http://localhost:5000/api/lists", {
        headers: { Authorization: `Bearer ${token}` },
    });
    const listsData = await listsRes.json();
    console.log("Lists count:", listsData.lists?.length);
    // 2. Get Prospects
    const prospectsRes = await fetch("http://localhost:5000/api/prospects", {
        headers: { Authorization: `Bearer ${token}` },
    });
    const prospectsData = await prospectsRes.json();
    console.log("Prospects total:", prospectsData.total);
    // 3. Test Unipile Account Health
    const healthRes = await fetch("http://localhost:5000/api/linkedin/account-health", {
        headers: { Authorization: `Bearer ${token}` },
    });
    const healthData = await healthRes.json();
    console.log("Unipile Health Connected:", healthData.connected, "Account Name:", healthData.status?.name);
}
testPhase3();

import "dotenv/config";
async function testUnipile() {
    const dsn = process.env.UNIPILE_DSN || "https://api16.unipile.com:14623";
    const apiKey = process.env.UNIPILE_API_KEY;
    const accountId = process.env.UNIPILE_ACCOUNT_ID;
    const url = `${dsn.replace(/\/$/, "")}/api/v1/accounts/${accountId}`;
    console.log("Testing Unipile API connection to:", url);
    try {
        const res = await fetch(url, {
            headers: {
                "X-API-KEY": apiKey || "",
                "Accept": "application/json",
            },
        });
        console.log("HTTP Status:", res.status, res.statusText);
        const data = await res.json();
        console.log("Account Info:", JSON.stringify(data, null, 2));
    }
    catch (err) {
        console.error("Connection Error:", err.message);
    }
}
testUnipile();

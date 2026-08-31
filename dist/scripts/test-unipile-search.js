import "dotenv/config";
async function testSearch() {
    const dsn = process.env.UNIPILE_DSN || "https://api16.unipile.com:14623";
    const apiKey = process.env.UNIPILE_API_KEY;
    const accountId = process.env.UNIPILE_ACCOUNT_ID;
    // Test 1: Standard Unipile search with keywords
    const url = `${dsn.replace(/\/$/, "")}/api/v1/linkedin/search?account_id=${accountId}`;
    console.log("POST to:", url);
    const payload = {
        api: "classic",
        category: "people",
        keywords: "commercial",
    };
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey || "",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload),
        });
        console.log("HTTP status:", res.status, res.statusText);
        const data = await res.json();
        console.log("Response data:", JSON.stringify(data, null, 2).slice(0, 1500));
    }
    catch (err) {
        console.error("Error:", err);
    }
}
testSearch();

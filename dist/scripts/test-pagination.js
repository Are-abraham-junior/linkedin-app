import "dotenv/config";
async function testUnipilePagination() {
    const dsn = process.env.UNIPILE_DSN || "https://api16.unipile.com:14623";
    const apiKey = process.env.UNIPILE_API_KEY;
    const accountId = process.env.UNIPILE_ACCOUNT_ID;
    const endpoint = `${dsn.replace(/\/$/, "")}/api/v1/linkedin/search?account_id=${accountId}`;
    console.log("Testing limit 25 parameter...");
    const res1 = await fetch(endpoint, {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey || "",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            api: "classic",
            category: "people",
            keywords: "commercial Abidjan",
            limit: 25,
        }),
    });
    const data1 = await res1.json();
    console.log("Page 1 items count:", data1.items?.length, "| Cursor:", data1.cursor);
    if (data1.cursor && data1.items?.length < 25) {
        console.log("Fetching Page 2 with cursor...");
        const res2 = await fetch(endpoint, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey || "",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                cursor: data1.cursor,
            }),
        });
        const data2 = await res2.json();
        console.log("Page 2 items count:", data2.items?.length, "| New Cursor:", data2.cursor);
    }
}
testUnipilePagination();

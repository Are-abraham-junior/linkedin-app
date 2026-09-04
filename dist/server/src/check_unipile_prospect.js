import "dotenv/config";
const UNIPILE_DSN = process.env.UNIPILE_DSN || "https://api43.unipile.com:17317";
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || "YSlLiQEj.nWSRIuxNb2mkDrVAzWcyNXP38jcr4+tFt9OpgGykHI8=";
const BASE_URL = UNIPILE_DSN.replace(/\/$/, "");
// Account ID for Abraham Are
const ACCOUNT_ID = "il23OtUyQ0iRXR7C_78gMw";
async function testProspectCheck() {
    console.log("Searching for Jean-Luc GNAKOURI via Unipile...");
    const resSearch = await fetch(`${BASE_URL}/api/v1/linkedin/search?account_id=${ACCOUNT_ID}`, {
        method: "POST",
        headers: {
            "X-API-KEY": UNIPILE_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            api: "classic",
            category: "people",
            keywords: "Jean-Luc GNAKOURI"
        })
    });
    console.log("Search HTTP status:", resSearch.status);
    const dataSearch = await resSearch.json();
    console.log("Search result item 0:", JSON.stringify(dataSearch?.items?.[0], null, 2));
    if (dataSearch?.items?.[0]?.public_identifier || dataSearch?.items?.[0]?.id) {
        const identifier = dataSearch.items[0].public_identifier || dataSearch.items[0].id;
        console.log(`Fetching user profile for ${identifier}...`);
        const resUser = await fetch(`${BASE_URL}/api/v1/users/${identifier}?account_id=${ACCOUNT_ID}`, {
            headers: {
                "X-API-KEY": UNIPILE_API_KEY,
                "Accept": "application/json"
            }
        });
        console.log("Profile HTTP status:", resUser.status);
        const userData = await resUser.json();
        console.log("User profile JSON:", JSON.stringify(userData, null, 2));
    }
}
testProspectCheck();

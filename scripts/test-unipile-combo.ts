import "dotenv/config";

async function testCombo() {
  const dsn = process.env.UNIPILE_DSN || "https://api16.unipile.com:14623";
  const apiKey = process.env.UNIPILE_API_KEY;
  const accountId = process.env.UNIPILE_ACCOUNT_ID;

  const url = `${dsn.replace(/\/$/, "")}/api/v1/linkedin/search?account_id=${accountId}`;

  const payload = {
    api: "classic",
    category: "people",
    keywords: "commercial Abidjan",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey || "",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Count items:", data.items?.length);
  if (data.items?.length > 0) {
    console.log("First item:", data.items[0].name, "|", data.items[0].headline, "|", data.items[0].location);
  }
}

testCombo();

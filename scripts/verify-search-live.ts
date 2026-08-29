import "dotenv/config";

async function verifySearchLive() {
  // Login to get token
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "jeanregis@bimelink.io", password: "Admin123!" }),
  });
  const { token } = await loginRes.json();

  // Search "commercial Abidjan"
  const searchRes = await fetch("http://localhost:5000/api/linkedin/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "commercial",
      location: "Abidjan",
      limit: 10,
    }),
  });

  const searchData = await searchRes.json();
  console.log("Search Success:", searchData.success);
  console.log("Profiles count returned:", searchData.count);
  if (searchData.profiles?.length > 0) {
    console.log("First profile:", searchData.profiles[0].fullName, "-", searchData.profiles[0].headline);
  }
}

verifySearchLive();

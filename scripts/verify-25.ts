import "dotenv/config";

async function verify25Profiles() {
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "jeanregis@bimelink.io", password: "Admin123!" }),
  });
  const { token } = await loginRes.json();

  console.log("Requesting limit: 25 profiles...");
  const searchRes = await fetch("http://localhost:5000/api/linkedin/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "commercial",
      location: "Abidjan",
      limit: 25,
    }),
  });

  const data = await searchRes.json();
  console.log("Success:", data.success);
  console.log("Profiles count returned:", data.count);
  console.log("Total Count available:", data.totalCount);
}

verify25Profiles();

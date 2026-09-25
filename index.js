const url = "https://version.astutech.online/";

async function test() {
  try {
    const response = await fetch(url);

    console.log("Status:", response.status);
    console.log("\nHeaders:");

    for (const [key, value] of response.headers) {
      console.log(`${key}: ${value}`);
    }

    const text = await response.text();

    console.log("\nResponse:");
    console.log(text);
  } catch (error) {
    console.error(error);
  }
}

test();
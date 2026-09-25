const url = "http://122.11.128.69:2205/";

async function test() {
  try {
    console.log("Testing:", url);

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual"
    });

    clearTimeout(timer);

    console.log("Status:", response.status);
    console.log("Status text:", response.statusText);

    console.log("\nHeaders:");
    for (const [key, value] of response.headers) {
      console.log(`${key}: ${value}`);
    }

    const body = await response.text();

    console.log("\n--- RESPONSE ---");
    console.log(body.slice(0, 2000));

  } catch (error) {
    console.log("Request failed:");
    console.log(error.message);
  }
}

test();
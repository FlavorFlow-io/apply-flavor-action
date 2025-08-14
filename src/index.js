import * as core from "@actions/core";

try {
  // Get flavor data from environment variables
  const flavorJson = process.env.FLAVOR_JSON;
  const flavorName = process.env.FLAVOR_NAME;
  const flavorId = process.env.FLAVOR_ID;
  
  if (!flavorJson) {
    throw new Error("FLAVOR_JSON environment variable is required");
  }

  core.info("=== Applying Branding Configuration ===");
  
  // Parse and display the flavor JSON
  let flavor;
  try {
    flavor = JSON.parse(flavorJson);
  } catch (parseError) {
    throw new Error(`Invalid flavor JSON in FLAVOR_JSON environment variable: ${parseError.message}`);
  }

  core.info(`Flavor Name: ${flavorName || flavor.name || flavor.id || 'Unknown'}`);
  core.info(`Flavor ID: ${flavorId || flavor.id || 'Unknown'}`);
  core.info("Flavor Configuration:");
  core.info(JSON.stringify(flavor, null, 2));

  // Log specific branding properties if they exist
  if (flavor.branding) {
    core.info("=== Branding Details ===");
    if (flavor.branding.appName) {
      core.info(`App Name: ${flavor.branding.appName}`);
    }
    if (flavor.branding.packageName) {
      core.info(`Package Name: ${flavor.branding.packageName}`);
    }
    if (flavor.branding.colors) {
      core.info(`Colors: ${JSON.stringify(flavor.branding.colors, null, 2)}`);
    }
    if (flavor.branding.logo) {
      core.info(`Logo URL: ${flavor.branding.logo}`);
    }
    if (flavor.branding.theme) {
      core.info(`Theme: ${JSON.stringify(flavor.branding.theme, null, 2)}`);
    }
  }

  // Log all available environment variables for debugging
  core.info("=== Environment Variables ===");
  core.info(`FLAVOR_JSON: ${flavorJson ? 'Set' : 'Not set'}`);
  core.info(`FLAVOR_NAME: ${flavorName || 'Not set'}`);
  core.info(`FLAVOR_ID: ${flavorId || 'Not set'}`);

  // Set outputs
  core.setOutput("status", "success");
  core.info("Branding configuration applied successfully!");

} catch (error) {
  core.setFailed(error.message);
}

<p align="center">
  <img src="./flavorflow_logo.png" alt="FlavorFlow Logo" width="180" />
</p>

# Apply FlavorFlow Configuration GitHub Action

This action applies complete flavor configuration including branding, assets, and environment variables for a specific flavor. It takes a flavor JSON object and applies the corresponding elements to your project, streamlining the process of customizing your application for different white-label clients.

**About the SaaS:**

[flavorflow.io](https://flavorflow.io) is a portal to manage white-label app clients. It helps you organize, configure, and maintain multiple branded versions of your application, streamlining the process of delivering customized apps to different customers.

## Features

- 🎨 **Theme Configuration**: Automatically applies light and dark theme colors
- 📦 **Package Management**: Updates package names and application IDs
- 🎯 **Asset Management**: Downloads and exposes assets as environment variables
- 🔧 **Environment Variables**: Sets flavor variables as environment variables
- 🏗️ **Project Type Support**: Supports different Android project types
- 📱 **Icon Generation**: Generates app icons from logos

## Inputs

### `flavor`

**Required** The flavor JSON object containing branding information for the specific client.

### `project-api-key`

**Required** The project API key to fetch additional resources if needed during the branding process.

### `assets-destination`

**Optional** Directory where assets should be downloaded. Default: `./assets`

### `project-type`

**Optional** The type of project to apply flavor to. Supported values:
- `android-native-compose`: Apply Compose theming and Android-specific configurations
- `android-native-xml`: Apply XML theming and Android-specific configurations
- If not specified, the action will only process environment variables and assets without any file manipulation

## Outputs

### `status`

The status of the branding application process.

### `flavor-name`

Name of the applied flavor.

### `package-name`

Package name that was applied.

### `logo-path`

Path to the downloaded logo file.

### `assets-downloaded`

Number of assets that were downloaded.

### `variables-set`

Number of environment variables that were set.

### `project-type`

Project type that was used ('android-native-compose', 'android-native-xml', or 'none').

## Usage Modes

### Android Project Mode
When `project-type` is set to `android-native-compose` or `android-native-xml`:
- ✅ Downloads and sets environment variables for assets
- ✅ Sets environment variables from flavor variables
- ✅ Downloads logo and generates app icons
- ✅ Updates Android app name, package name, and application ID
- ✅ Applies theming (Compose or XML based on project type)

### Environment Variables Only Mode
When `project-type` is **not specified**:
- ✅ Downloads and sets environment variables for assets
- ✅ Sets environment variables from flavor variables
- ❌ No file manipulation (no theming, no package changes, no logo processing)
- ❌ No icon generation
- ❌ No package id renaming

This mode is useful for non-Android projects or when you only need the assets and variables without any Android-specific branding.

## Example usage

```yaml
# Apply branding for a specific flavor:
steps:
  - id: apply-branding
  uses: FlavorFlow-io/apply-flavor-action@v1
    with:
      flavor: ${{ matrix.flavor }}
      project-api-key: ${{ secrets.PROJECT_API_KEY }}
      project-type: 'android-native-compose'  # Optional
      assets-destination: './custom-assets'   # Optional
  - name: Check branding status
    run: |
      echo "Branding status: ${{ steps.apply-branding.outputs.status }}"
      echo "Assets downloaded: ${{ steps.apply-branding.outputs.assets-downloaded }}"
      echo "Variables set: ${{ steps.apply-branding.outputs.variables-set }}"
      echo "Project type: ${{ steps.apply-branding.outputs.project-type }}"
```

### Environment Variables Only Mode Example

```yaml
# Only set environment variables without any file manipulation:
steps:
  - id: apply-variables
  uses: FlavorFlow-io/apply-flavor-action@v1
    with:
      flavor: ${{ matrix.flavor }}
      project-api-key: ${{ secrets.PROJECT_API_KEY }}
      # No project-type specified = environment variables only mode
      assets-destination: './assets'
  - name: Use environment variables
    run: |
      echo "Using variables: $MANDATORY_1, $TESTE"
      echo "Using assets: $MANDATORY_ASSET, $NON_MANDATORY_ASSET"
```

### Environment Variables

After running this action, the following environment variables will be available:

**From flavor.variables:**
- All variables from the flavor configuration are set as uppercase environment variables
- Example: `MANDATORY_1`, `TESTE`, `NON_MANDATORY_BOOL`, etc.

**From flavor.assets:**
- All assets are downloaded and their absolute paths are set as uppercase environment variables
- Example: `MANDATORY_ASSET=/path/to/downloaded/asset.ext`, `NON_MANDATORY_ASSET=/path/to/asset.ext`

## Matrix build example

You can combine this action with the flavorflow-fetch-flavors-action to create a complete white-label build pipeline:

```yaml
jobs:
  fetch-flavors:
    runs-on: ubuntu-latest
    outputs:
      flavors: ${{ steps.fetch-flavors.outputs.flavors }}
    steps:
      - id: fetch-flavors
  uses: FlavorFlow-io/fetch-flavors-action@v1
        with:
          project-api-key: ${{ secrets.PROJECT_API_KEY }}

  build:
    needs: fetch-flavors
    runs-on: ubuntu-latest
    strategy:
      matrix:
        flavor: ${{ fromJson(needs.fetch-flavors.outputs.flavors) }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Apply branding
  uses: FlavorFlow-io/apply-flavor-action@v1
        with:
          flavor: ${{ matrix.flavor }}
          project-api-key: ${{ secrets.PROJECT_API_KEY }}
          project-type: 'android-native-compose'  # Specify project type
      
      - name: Build for flavor
        run: |
          echo "Building for flavor: ${{ matrix.flavor.name }}"
          # add your build steps here
```
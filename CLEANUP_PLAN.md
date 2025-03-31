# Codebase Cleanup Plan

## Duplicate React Application Consolidation

### Current state
The codebase currently has two separate React applications:

1. **Root-level React app** (in `/src`):
   - Uses Webpack and manual configuration
   - Appears to be an older version of the frontend
   - Has older, duplicate components
   - Not referenced in the start_servers.sh script

2. **Frontend React app** (in `/frontend/src`):
   - Uses Create React App (CRA)
   - More modern structure with pages and components
   - More recent timestamps
   - Used in the start_servers.sh script

### Cleanup Plan

1. **Review and migrate any unique code**:
   - Scan through files in the root `/src` to identify any unique functionality
   - Pay special attention to components like ProjectDetail.js, MapDetail.js
   - Ensure any useful code is integrated with the frontend application

2. **Remove the duplicate files**:
   - Delete the root `/src` directory
   - Delete root `/public` directory if it's only used by the root app
   - Delete webpack.config.js since it's only used by the root app
   - Update the root package.json to remove webpack-related scripts/dependencies

3. **Documentation**:
   - Update the README.md to explain the consolidation
   - Document any major code migrations that occurred

4. **Testing**:
   - Test the application by running `./start_servers.sh`
   - Verify all functionality still works properly

### Files to be removed:
- `/src` folder and all its contents
- `/webpack.config.js`
- `/public` folder (after verification it's not used by the frontend app)

### Dependencies to be removed from root package.json:
- webpack
- webpack-cli
- webpack-dev-server
- babel-loader
- @babel/core
- @babel/preset-env
- @babel/preset-react
- css-loader
- style-loader
- file-loader
- html-webpack-plugin 
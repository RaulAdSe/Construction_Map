/**
 * This script patches the main application to use the Cloud SQL Auth Proxy connection
 * Run this script after deployment to update the connection
 */
const fs = require('fs');
const path = require('path');

// Target files in the actual application
const targetFiles = {
  dbConnection: path.join(__dirname, '..', '..', 'src', 'db.js'),
  dbTestRoute: path.join(__dirname, '..', '..', 'src', 'routes', 'db-test.js'),
  app: path.join(__dirname, '..', '..', 'src', 'app.js')
};

// Source files from the deployment directory
const sourceFiles = {
  dbConnection: path.join(__dirname, 'db-connection.js'),
  dbTestRoute: path.join(__dirname, 'db-test.js')
};

// Function to copy files
function copyFile(source, target) {
  console.log(`Copying ${source} to ${target}...`);
  try {
    const content = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(target, content, 'utf8');
    console.log(`Successfully copied ${source} to ${target}`);
    return true;
  } catch (err) {
    console.error(`Error copying ${source} to ${target}:`, err);
    return false;
  }
}

// Execute the patching
console.log('Starting application patching for Cloud SQL Auth Proxy...');

// Copy the database connection file
copyFile(sourceFiles.dbConnection, targetFiles.dbConnection);

// Copy the db-test route
copyFile(sourceFiles.dbTestRoute, targetFiles.dbTestRoute);

// Ensure the route is correctly included in the app
console.log('Checking if app.js needs to be updated to include db-test route...');
try {
  const appContent = fs.readFileSync(targetFiles.app, 'utf8');
  
  // Check if the db-test route is already included
  if (!appContent.includes('/db-test')) {
    console.log('Adding db-test route to app.js...');
    
    // Add the import statement
    let updatedContent = appContent.replace(
      'const express = require(\'express\');',
      'const express = require(\'express\');\nconst dbTestRouter = require(\'./routes/db-test\');'
    );
    
    // Add the route registration
    updatedContent = updatedContent.replace(
      'app.use(express.json());',
      'app.use(express.json());\napp.use(\'/db-test\', dbTestRouter);'
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(targetFiles.app, updatedContent, 'utf8');
    console.log('Successfully updated app.js to include db-test route');
  } else {
    console.log('db-test route is already included in app.js');
  }
} catch (err) {
  console.error('Error updating app.js:', err);
}

console.log('Application patching complete.'); 
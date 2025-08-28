const { execSync } = require('child_process');
const fs = require('fs');

function deploy(versionType = 'patch') {
  try {
    console.log('🚀 Starting Render deployment...');
    
    // Update version
    console.log(`📦 Updating ${versionType} version...`);
    execSync(`npm version ${versionType}`, { stdio: 'inherit' });
    
    // Get new version
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const newVersion = packageJson.version;
    
    console.log(`✨ New version: ${newVersion}`);
    
    // Add all changes
    console.log('📝 Adding changes to git...');
    execSync('git add .', { stdio: 'inherit' });
    
    // Commit changes
    console.log('💾 Committing changes...');
    execSync(`git commit -m "Deploy v${newVersion} to Render"`, { stdio: 'inherit' });
    
    // Push to trigger auto-deploy on Render
    console.log('🔄 Pushing to GitHub (triggers Render deployment)...');
    execSync('git push origin master', { stdio: 'inherit' });
    
    console.log('\n✅ Deployment initiated successfully!');
    console.log(`🎉 Version ${newVersion} has been pushed to GitHub`);
    console.log('🔄 Render will automatically deploy your changes in a few minutes');
    console.log('\n📊 Monitor deployment:');
    console.log('   🔗 Render Dashboard: https://dashboard.render.com');
    console.log('   🔗 App Health: https://your-app-name.onrender.com/health');
    console.log('\n💡 Deployment typically takes 2-5 minutes');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Make sure you have uncommitted changes');
    console.log('   2. Check if you\'re on the correct branch (master)');
    console.log('   3. Ensure you have push permissions to the repository');
    console.log('   4. Verify your git remote is set correctly');
    process.exit(1);
  }
}

// Get version type from command line arguments
const versionType = process.argv[2] || 'patch';

// Validate version type
if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Invalid version type. Use: patch, minor, or major');
  process.exit(1);
}

console.log(`🎯 Deploying with ${versionType} version bump...`);
deploy(versionType);

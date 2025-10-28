#!/usr/bin/env node

/**
 * Verification script for Vertex AI Gemini configuration
 * 
 * This script verifies that the Perfect Plate app is correctly configured
 * to use Vertex AI Gemini API.
 * 
 * Usage:
 *   node verify-config.js
 * 
 * Or with environment variables:
 *   GEMINI_API_KEY=... GEMINI_API_ENDPOINT=... node verify-config.js
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, checks) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`✗ File not found: ${filePath}`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  let allPassed = true;
  
  for (const check of checks) {
    if (check.regex) {
      if (check.shouldMatch) {
        if (content.match(check.regex)) {
          log(`  ✓ ${check.description}`, 'green');
        } else {
          log(`  ✗ ${check.description}`, 'red');
          allPassed = false;
        }
      } else {
        if (!content.match(check.regex)) {
          log(`  ✓ ${check.description}`, 'green');
        } else {
          log(`  ✗ ${check.description}`, 'red');
          allPassed = false;
        }
      }
    }
  }
  
  return allPassed;
}

function main() {
  log('\n🔍 Verifying Vertex AI Gemini Configuration\n', 'bright');
  
  let allChecksPass = true;
  
  // Check .env.example
  log('Checking .env.example...', 'blue');
  allChecksPass &= checkFile('.env.example', [
    {
      description: 'Contains Vertex AI API key (AQ.Ab8RN6...)',
      regex: /GEMINI_API_KEY=AQ\.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg/,
      shouldMatch: true
    },
    {
      description: 'Sets GEMINI_API_ENDPOINT=vertex',
      regex: /GEMINI_API_ENDPOINT=vertex/,
      shouldMatch: true
    },
    {
      description: 'Sets GEMINI_MODEL=gemini-2.5-pro',
      regex: /GEMINI_MODEL=gemini-2\.5-pro/,
      shouldMatch: true
    },
    {
      description: 'No placeholder API keys (your_api_key_here)',
      regex: /GEMINI_API_KEY=your_api_key_here/,
      shouldMatch: false
    }
  ]);
  
  // Check generate-plan.js
  log('\nChecking netlify/functions/generate-plan.js...', 'blue');
  allChecksPass &= checkFile('netlify/functions/generate-plan.js', [
    {
      description: 'Uses process.env.GEMINI_API_KEY',
      regex: /process\.env\.GEMINI_API_KEY/,
      shouldMatch: true
    },
    {
      description: 'Defaults to "vertex" endpoint',
      regex: /process\.env\.GEMINI_API_ENDPOINT\s*\|\|\s*['""]vertex['"]/,
      shouldMatch: true
    },
    {
      description: 'Supports Vertex AI endpoint',
      regex: /aiplatform\.googleapis\.com/,
      shouldMatch: true
    },
    {
      description: 'No hardcoded API keys',
      regex: /AIzaSy[A-Za-z0-9_-]{33}/,
      shouldMatch: false
    }
  ]);
  
  // Check health-check.js
  log('\nChecking netlify/functions/health-check.js...', 'blue');
  allChecksPass &= checkFile('netlify/functions/health-check.js', [
    {
      description: 'Uses process.env.GEMINI_API_KEY',
      regex: /process\.env\.GEMINI_API_KEY/,
      shouldMatch: true
    },
    {
      description: 'Defaults to "vertex" endpoint',
      regex: /process\.env\.GEMINI_API_ENDPOINT\s*\|\|\s*['""]vertex['"]/,
      shouldMatch: true
    },
    {
      description: 'Supports Vertex AI endpoint check',
      regex: /vertex.*aiplatform\.googleapis\.com/s,
      shouldMatch: true
    }
  ]);
  
  // Check list-models.js
  log('\nChecking netlify/functions/list-models.js...', 'blue');
  allChecksPass &= checkFile('netlify/functions/list-models.js', [
    {
      description: 'Uses process.env.GEMINI_API_KEY',
      regex: /process\.env\.GEMINI_API_KEY/,
      shouldMatch: true
    },
    {
      description: 'Defaults to "vertex" endpoint',
      regex: /process\.env\.GEMINI_API_ENDPOINT\s*\|\|\s*['""]vertex['"]/,
      shouldMatch: true
    }
  ]);
  
  // Check README.md
  log('\nChecking README.md...', 'blue');
  allChecksPass &= checkFile('README.md', [
    {
      description: 'Documents Vertex AI as Option 1 (default)',
      regex: /Option 1.*Vertex AI.*Default/s,
      shouldMatch: true
    },
    {
      description: 'Contains Vertex AI API key',
      regex: /AQ\.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg/,
      shouldMatch: true
    },
    {
      description: 'References NETLIFY_SETUP.md',
      regex: /NETLIFY_SETUP\.md/,
      shouldMatch: true
    }
  ]);
  
  // Check for NETLIFY_SETUP.md existence
  log('\nChecking NETLIFY_SETUP.md...', 'blue');
  allChecksPass &= checkFile('NETLIFY_SETUP.md', [
    {
      description: 'Contains setup instructions',
      regex: /Environment Variables Setup/,
      shouldMatch: true
    },
    {
      description: 'Contains Vertex AI API key',
      regex: /AQ\.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg/,
      shouldMatch: true
    },
    {
      description: 'Contains step-by-step instructions',
      regex: /Step-by-Step Configuration/,
      shouldMatch: true
    }
  ]);
  
  // Check environment variables (if running in Netlify context)
  log('\nChecking runtime environment variables...', 'blue');
  const envKey = process.env.GEMINI_API_KEY;
  const envEndpoint = process.env.GEMINI_API_ENDPOINT;
  const envModel = process.env.GEMINI_MODEL;
  
  if (envKey) {
    if (envKey.startsWith('AQ.')) {
      log('  ✓ GEMINI_API_KEY is set and has Vertex AI format', 'green');
    } else {
      log('  ⚠ GEMINI_API_KEY is set but does not have Vertex AI format (AQ.*)', 'yellow');
    }
  } else {
    log('  ℹ GEMINI_API_KEY not set (OK for local verification)', 'yellow');
  }
  
  if (envEndpoint) {
    if (envEndpoint === 'vertex' || envEndpoint === 'vertexai') {
      log('  ✓ GEMINI_API_ENDPOINT is set to vertex', 'green');
    } else {
      log(`  ⚠ GEMINI_API_ENDPOINT is set to '${envEndpoint}' (not 'vertex')`, 'yellow');
    }
  } else {
    log('  ℹ GEMINI_API_ENDPOINT not set (will default to "vertex")', 'yellow');
  }
  
  if (envModel) {
    if (envModel === 'gemini-2.5-pro') {
      log('  ✓ GEMINI_MODEL is set to gemini-2.5-pro', 'green');
    } else {
      log(`  ⚠ GEMINI_MODEL is set to '${envModel}' (expected 'gemini-2.5-pro')`, 'yellow');
    }
  } else {
    log('  ℹ GEMINI_MODEL not set (will default to "gemini-2.5-pro")', 'yellow');
  }
  
  // Final summary
  log('\n' + '='.repeat(60), 'bright');
  if (allChecksPass) {
    log('✓ All configuration checks passed!', 'green');
    log('\nNext steps:', 'bright');
    log('1. Set environment variables in Netlify dashboard:', 'blue');
    log('   - GEMINI_API_KEY = AQ.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg');
    log('   - GEMINI_API_ENDPOINT = vertex');
    log('   - GEMINI_MODEL = gemini-2.5-pro');
    log('2. Deploy to Netlify');
    log('3. Test with: https://your-site.netlify.app/.netlify/functions/health-check');
    log('4. Verify with: https://your-site.netlify.app/test-api.html');
    log('\nSee NETLIFY_SETUP.md for detailed instructions.', 'blue');
    process.exit(0);
  } else {
    log('✗ Some configuration checks failed!', 'red');
    log('Please review the errors above and fix the configuration.', 'yellow');
    process.exit(1);
  }
}

main();

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

async function generateFavicons() {
    try {
        // Load the new favicon image
        const faviconPath = path.join(publicDir, 'favicon.png');
        
        if (!fs.existsSync(faviconPath)) {
            console.error('Error: favicon.png not found in public directory');
            return;
        }
        
        console.log('Loading favicon image...');
        const faviconImage = await loadImage(faviconPath);
        
        // Define all the sizes we need to generate
        const sizes = [
            { size: 16, name: 'favicon-16x16.png' },
            { size: 32, name: 'favicon-32x32.png' },
            { size: 48, name: 'favicon-48x48.png' },
            { size: 64, name: 'favicon-64x64.png' },
            { size: 128, name: 'favicon-128x128.png' },
            { size: 256, name: 'favicon-256x256.png' },
            { size: 512, name: 'favicon-512x512.png' },
            { size: 180, name: 'apple-touch-icon.png' }
        ];
        
        console.log('Generating favicon files...');
        
        // Generate each size
        for (const { size, name } of sizes) {
            const canvas = createCanvas(size, size);
            const ctx = canvas.getContext('2d');
            
            // Clear canvas with transparent background
            ctx.clearRect(0, 0, size, size);
            
            // Draw the resized image
            ctx.drawImage(faviconImage, 0, 0, size, size);
            
            // Save the file
            const outputPath = path.join(publicDir, name);
            fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
            console.log(`Generated: ${name}`);
        }
        
        // Generate favicon.ico (using 32x32 version)
        console.log('Generating favicon.ico...');
        const icoCanvas = createCanvas(32, 32);
        const icoCtx = icoCanvas.getContext('2d');
        icoCtx.clearRect(0, 0, 32, 32);
        icoCtx.drawImage(faviconImage, 0, 0, 32, 32);
        
        const icoPath = path.join(publicDir, 'favicon.ico');
        fs.writeFileSync(icoPath, icoCanvas.toBuffer('image/png'));
        console.log('Generated: favicon.ico');
        
        // Update icon.png (using 48x48 version)
        console.log('Updating icon.png...');
        const iconCanvas = createCanvas(48, 48);
        const iconCtx = iconCanvas.getContext('2d');
        iconCtx.clearRect(0, 0, 48, 48);
        iconCtx.drawImage(faviconImage, 0, 0, 48, 48);
        
        const iconPath = path.join(publicDir, 'icon.png');
        fs.writeFileSync(iconPath, iconCanvas.toBuffer('image/png'));
        console.log('Updated: icon.png');
        
        console.log('\n✅ All favicon files generated successfully!');
        console.log('Generated files:');
        sizes.forEach(({ name }) => console.log(`- ${name}`));
        console.log('- favicon.ico');
        console.log('- icon.png (updated)');
        
    } catch (error) {
        console.error('Error generating favicons:', error);
    }
}

// Run the script
generateFavicons();

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

function createFavicon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.5, '#ffa500');
    gradient.addColorStop(1, '#ffeb3b');
    
    // Draw background with rounded corners
    ctx.fillStyle = gradient;
    const radius = size * 0.25;
    roundRect(ctx, 0, 0, size, size, radius);
    ctx.fill();
    
    // Draw drop icon
    const dropSize = size * 0.625;
    const dropX = size * 0.5;
    const dropY = size * 0.5;
    
    ctx.save();
    ctx.translate(dropX, dropY);
    ctx.rotate(-Math.PI / 4);
    
    const dropGradient = ctx.createLinearGradient(-dropSize/2, -dropSize/2, dropSize/2, dropSize/2);
    dropGradient.addColorStop(0, '#4fc3f7');
    dropGradient.addColorStop(0.5, '#29b6f6');
    dropGradient.addColorStop(1, '#0288d1');
    
    ctx.fillStyle = dropGradient;
    ctx.beginPath();
    ctx.arc(0, 0, dropSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Add highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(-dropSize/4, -dropSize/4, dropSize/6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    return canvas;
}

function createOGImage() {
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#FFE4E1');
    gradient.addColorStop(0.5, '#FFF0F5');
    gradient.addColorStop(1, '#FFE4E1');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);
    
    // Add floating drops
    for (let i = 0; i < 4; i++) {
        const x = 100 + (i * 300);
        const y = 100 + (i % 2) * 200;
        const size = 40 + (i * 10);
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4);
        
        const dropGradient = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
        dropGradient.addColorStop(0, 'rgba(79, 195, 247, 0.1)');
        dropGradient.addColorStop(1, 'rgba(2, 136, 209, 0.1)');
        
        ctx.fillStyle = dropGradient;
        ctx.beginPath();
        ctx.arc(0, 0, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // Logo
    const logoX = 600;
    const logoY = 200;
    
    // Logo background
    const logoGradient = ctx.createLinearGradient(logoX - 40, logoY - 40, logoX + 40, logoY + 40);
    logoGradient.addColorStop(0, '#ff6b6b');
    logoGradient.addColorStop(0.5, '#ffa500');
    logoGradient.addColorStop(1, '#ffeb3b');
    
    ctx.fillStyle = logoGradient;
    roundRect(ctx, logoX - 40, logoY - 40, 80, 80, 20);
    ctx.fill();
    
    // Drop icon
    ctx.save();
    ctx.translate(logoX, logoY);
    ctx.rotate(-Math.PI / 4);
    
    const dropGradient = ctx.createLinearGradient(-25, -25, 25, 25);
    dropGradient.addColorStop(0, '#4fc3f7');
    dropGradient.addColorStop(0.5, '#29b6f6');
    dropGradient.addColorStop(1, '#0288d1');
    
    ctx.fillStyle = dropGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(-12, -12, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Text
    ctx.fillStyle = '#2d3748';
    ctx.font = 'bold 72px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DropCast', logoX + 60, logoY + 20);
    
    ctx.fillStyle = '#4a5568';
    ctx.font = '500 32px Inter, Arial, sans-serif';
    ctx.fillText('Community Rewards', logoX + 60, logoY + 60);
    
    ctx.fillStyle = '#718096';
    ctx.font = '400 24px Inter, Arial, sans-serif';
    ctx.fillText('Make airdrops for users who engage with your Farcaster post', logoX + 60, logoY + 100);
    
    return canvas;
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Generate favicons
console.log('Generating favicons...');
const favicon16 = createFavicon(16);
const favicon32 = createFavicon(32);
const favicon48 = createFavicon(48);

fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), favicon16.toBuffer('image/png'));
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favicon32.toBuffer('image/png'));
fs.writeFileSync(path.join(publicDir, 'favicon-48x48.png'), favicon48.toBuffer('image/png'));

// Generate main favicon (32x32)
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon32.toBuffer('image/png'));

// Generate OG image
console.log('Generating OG image...');
const ogImage = createOGImage();
fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogImage.toBuffer('image/png'));

// Generate icon.png (for the app)
fs.writeFileSync(path.join(publicDir, 'icon.png'), favicon48.toBuffer('image/png'));

console.log('Assets generated successfully!');
console.log('Generated files:');
console.log('- favicon-16x16.png');
console.log('- favicon-32x32.png');
console.log('- favicon-48x48.png');
console.log('- favicon.ico');
console.log('- og-image.png');
console.log('- icon.png');

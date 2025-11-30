# MapTiler API Key Setup

## 🎯 Why MapTiler?

MapTiler provides high-quality vector tiles with:
- **Full basemap styling** (roads, buildings, labels, terrain)
- **Free tier**: 100,000 tile loads/month
- **Better performance** than OpenFreeMap for detailed maps
- **Professional cartography** with multiple style options

## 🔑 Getting a Free API Key

### Step 1: Create Account
1. Go to [https://maptiler.com/cloud/](https://maptiler.com/cloud/)
2. Click **"Sign up for FREE"**
3. Use GitHub/Google login or create account with email

### Step 2: Get API Key
1. Once logged in, go to **Account → Keys**
2. Copy your **Default API key** (auto-generated)
3. Or create a new key with custom name

### Step 3: Add to .env
1. Open `/home/rongzhou/Documents/ronBureau/frontend/.env`
2. Replace the placeholder:
   ```
   MAPTILER_API_KEY="YOUR_KEY_HERE"
   ```

### Step 4: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

## 📊 Free Tier Limits

| Resource | Free Tier | Notes |
|----------|-----------|-------|
| Tile Loads | 100,000/month | ~3,300/day |
| Maps SDK | Included | Client-side rendering |
| Geocoding | 2,500/month | Optional |
| Static Maps | 2,500/month | Optional |

**Note**: Vector tiles are very efficient — 100k loads = thousands of map views!

## 🌐 Alternative: OpenFreeMap (Fallback)

If you don't want to use MapTiler or exceed limits:
- App automatically falls back to **OpenFreeMap**
- Completely free, no API key required
- Slightly less detailed styling
- Still fully functional

## 🎨 Available MapTiler Styles

Once you have an API key, you can switch styles:

```typescript
// In toggleVectorTiles() function
const styleUrl = `https://api.maptiler.com/maps/STYLE/style.json?key=${maptilerKey}`;

// Available styles:
// - basic-v2 (default, clean OSM style)
// - streets-v2 (detailed street map)
// - outdoor-v2 (hiking/outdoor activities)
// - satellite (hybrid satellite + labels)
// - topo-v2 (topographic map)
// - winter-v2 (ski/winter sports)
```

## ✅ Verification

After adding your key:
1. Open http://localhost:3000/maps
2. Click the globe icon (🌐) to toggle vector tiles
3. Status should show: **"Vector tiles loaded (MapTiler)"**
4. Map should load with crisp, styled basemap

## 🚨 Troubleshooting

### "Failed to load vector tiles"
- Check API key is correct in `.env`
- Restart dev server after changing `.env`
- Check browser console for errors
- Verify internet connection

### "Vector tiles loaded (OpenFreeMap)"
- This means MapTiler key wasn't found or invalid
- App is using free fallback (still works!)
- Add/fix MapTiler key to get better styling

### Tiles not loading
- Check browser console (F12 → Console)
- Look for CORS errors or 403 (unauthorized)
- Verify API key has not expired
- Check MapTiler dashboard usage

## 📈 Monitoring Usage

1. Go to [MapTiler Cloud Dashboard](https://cloud.maptiler.com/)
2. Check **Statistics** tab
3. Monitor tile loads
4. Set up alerts for 80% usage

## 💡 Pro Tips

1. **Development**: Free tier is perfect for dev/testing
2. **Production**: Consider paid plan if >100k loads/month
3. **Optimization**: Use caching to reduce tile requests
4. **Hybrid**: Mix MapTiler for key features, OpenFreeMap for secondary maps

## 🔗 Useful Links

- [MapTiler Documentation](https://docs.maptiler.com/)
- [Vector Tiles Guide](https://docs.maptiler.com/cloud/api/tiles/)
- [Pricing Plans](https://www.maptiler.com/cloud/plans/)
- [OpenFreeMap](https://openfreemap.org/) (free alternative)

---

**Current Status**: Configured with fallback to OpenFreeMap  
**Recommended**: Add MapTiler key for best experience

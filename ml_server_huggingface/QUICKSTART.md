# 🚀 QUICK START - Deploy in 5 Minutes

## The Fastest Way to Deploy

### Step 1: Create Hugging Face Account (1 min)
Go to https://huggingface.co/ → Sign up (free)

### Step 2: Create Space (1 min)
1. Visit https://huggingface.co/spaces
2. Click "Create new Space"
3. Name: `marks-extraction-ocr-api`
4. SDK: Choose **Docker** ⚠️ IMPORTANT!
5. Hardware: **CPU basic** (free)
6. Click "Create Space"

### Step 3: Deploy (2 min)
```bash
# Clone your space
git clone https://huggingface.co/spaces/YOUR_USERNAME/marks-extraction-ocr-api
cd marks-extraction-ocr-api

# Copy files (Windows PowerShell)
Copy-Item -Path "E:\CSE\CODES\github\CSE-3200-System-Development-Project-ML-Integrated-LMS\ml_server_huggingface\*" -Destination . -Recurse

# Deploy
git add .
git commit -m "Deploy ML server"
git push
```

### Step 4: Wait & Test (10-15 min for first build)
Visit: `https://YOUR_USERNAME-marks-extraction-ocr-api.hf.space/health`

### Step 5: Use in Your App (1 min)
```javascript
const API_URL = "https://YOUR_USERNAME-marks-extraction-ocr-api.hf.space/api/extract-marks";
```

## Done! 🎉

Your ML server is now hosted on Hugging Face!

---

## Need More Details?

- **Complete guide**: Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Checklist**: Use [CHECKLIST.md](CHECKLIST.md) to track progress
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- **Overview**: Check [SUMMARY.md](SUMMARY.md) for full overview

## Troubleshooting

**Build fails?** → Check Space logs on Hugging Face
**Slow?** → Upgrade hardware tier in Space settings
**Not working?** → Read DEPLOYMENT_GUIDE.md section "Troubleshooting"

---

**Time: ~5 min setup + 15 min build = 20 min total to deployment! ⚡**

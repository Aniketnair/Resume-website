# Aniket Nair — Career Website

Two sites in one project, both plain HTML/CSS/JS — no build tools, no framework, no server required.

```
resume-website/
├── index.html          🚀 Space Journey — the interactive scroll experience (main entry point)
├── resume.html          📄 Classic Resume — traditional professional site (was the old index.html)
├── experience.html       Career history, education, skills (classic site)
├── highlights.html       Selected projects (classic site)
├── contact.html          Contact info (classic site)
├── css/
│   ├── style.css         Styles for the classic site
│   └── space.css         Styles for the Space Journey
├── js/
│   ├── main.js           Mobile nav toggle for the classic site
│   └── space.js           Starfield, scroll animation, synthesized audio, orbit/modal logic
└── README.md
```

Every page in the classic site has a "🚀 Space Journey" button in its nav bar, and the
Space Journey has a "📄 Classic Resume" button in its top-right corner — visitors can hop
between the two freely. Both work identically once deployed; `index.html` is simply what
loads first at the site's root URL.

## The Space Journey (index.html)

Your career told as a scroll-driven flight through space: Earth (education + early
career) → Analyst → Consultant/Team Lead → Senior Consultant, with your four career
highlights (Statement Content Hub, Audit Process Automation, AccessAgent, Gen AI
Document Processing) rendered as satellites that orbit the Senior Consultant planet.
Click any planet or satellite for a detail card.

- **Sound** is fully synthesized in-browser with the Web Audio API — an ambient drone,
  a "whoosh" on each chapter transition, and a soft blip on clicks — no audio files are
  bundled. It starts muted; visitors click "Enable Sound" in the top-left to turn it on
  (required by every browser's autoplay policy anyway).
- **Navigation**: scroll normally to fly through the chapters, or click the small dots on
  the right edge of the screen to jump straight to a chapter.
- Built with plain CSS animations and a canvas starfield — no JS libraries, so it stays
  fast and dependency-free like the rest of the site.
- Respects `prefers-reduced-motion` (animations are disabled for visitors who've set that
  preference) and works on touch devices (satellite labels tuck away on small screens to
  keep things tidy).

## Personalize before you publish

- **contact.html** and the Space Journey's beacon section both say "Add your LinkedIn URL
  here" — replace both with your real LinkedIn link (or remove those cards).
- **Photo (optional)**: if you want a headshot on the classic site, add an image to a new
  `assets/` folder and reference it in `resume.html`'s hero section.
- **Resume PDF (optional)**: drop a PDF into the project folder (e.g.
  `assets/Aniket_Nair_Resume.pdf`) and add a "Download Resume" button linking to it.
- Double-check all dates, titles, and figures against your current resume — the content
  here was drafted from career details you've shared previously.

## Run it locally

No server needed — just open the file:

- **Windows**: double-click `index.html`, or right-click → Open with → your browser.

For a closer-to-production preview (recommended, so relative links behave exactly like on a real server), run a tiny local web server from the project folder:

```bash
# Python 3 (already on most systems)
cd resume-website
python -m http.server 8000
# then visit http://localhost:8000 in your browser
```

Or, if you use VS Code, the **Live Server** extension gives you the same thing with auto-reload on save.

## Deploy to AWS (S3 static website hosting — free tier)

This site is 100% static, which makes S3 static website hosting a great fit — no EC2 server to manage or pay for, and comfortably within AWS's free tier for a low-traffic personal site.

1. **Create an S3 bucket**
   - AWS Console → S3 → *Create bucket*.
   - Bucket name must be globally unique (e.g. `aniketnair-resume`, or your future domain name like `aniketnair.com` if you plan to use a custom domain).
   - Region: pick one close to you (e.g. `us-east-1`).
   - Uncheck "Block all public access" (a static website bucket needs to be publicly readable) and acknowledge the warning.

2. **Enable static website hosting**
   - Open the bucket → **Properties** tab → **Static website hosting** → *Edit* → Enable.
   - Index document: `index.html`
   - Error document: `index.html` (or leave blank — up to you)
   - Save. AWS will show you a **bucket website endpoint** URL (something like `http://your-bucket.s3-website-us-east-1.amazonaws.com`) — that's your live site once the steps below are done.

3. **Add a bucket policy for public read access**
   - Bucket → **Permissions** tab → **Bucket policy** → paste (replace `YOUR-BUCKET-NAME`):

     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "PublicReadGetObject",
           "Effect": "Allow",
           "Principal": "*",
           "Action": "s3:GetObject",
           "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
         }
       ]
     }
     ```

4. **Upload your files**
   - Bucket → **Objects** tab → *Upload* → drag in `index.html`, `experience.html`, `highlights.html`, `contact.html`, and the `css/` and `js/` folders (keep the same folder structure).
   - Or, with the AWS CLI installed and configured (`aws configure`):

     ```bash
     aws s3 sync . s3://YOUR-BUCKET-NAME --exclude "README.md"
     ```

5. **Visit your site**
   - Use the bucket website endpoint from step 2. It should look identical to what you see locally.

6. **(Optional) Add HTTPS and a custom domain**
   - S3 website endpoints are HTTP-only. For HTTPS and a custom domain (e.g. `www.aniketnair.com`), put **CloudFront** in front of the bucket (also free-tier eligible) and request a free certificate via **AWS Certificate Manager**. If/when you want this, ask and it can be set up step by step.

### Staying in the free tier

AWS Free Tier (first 12 months on a new account) includes 5 GB of S3 standard storage and enough request/data-transfer allowance to comfortably run a personal site like this. A resume site's storage footprint is a few hundred KB, so cost risk is minimal — just avoid uploading large media files, and consider setting a AWS Budget alert (Billing → Budgets) for extra peace of mind.

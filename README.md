# Call Me Maybe 🤙

live video dating app

- Lock in with a match for 15 minutes
- No brainless swiping

Upvote us on Product Hunt

<div style="display: flex; align-items: center;">
    <a href="https://www.producthunt.com/posts/call-me-maybe?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-call&#0045;me&#0045;maybe" target="_blank">
        <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=880188&theme=light&t=1739691988280" alt="Call&#0032;Me&#0032;Maybe - Swipe&#0032;less&#0044;&#0032;vibe&#0032;more&#0046;&#0032;Call&#0032;Me&#0032;Maybe&#0063; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" />
    </a>
    <a href="https://callmemaybe.xyz" target="_blank">
        <img alt="Static Badge" src="https://img.shields.io/badge/-callmemaybe.xyz-blue?style=for-the-badge&logo=call" style="margin-left: 10px; width: 250px; height: 54px; border-radius: 8px;" />
    </a>
</div>




## Setup

Make sure you have Node.js and npm installed on your machine before starting the setup.

1. Fork and Clone the repository:
   ```bash
   git clone https://github.com/<yourusername>/random-retarded-3am-project call-me-maybe
   cd call-me-maybe
   ```

2. Install the required dependencies:
   ```bash
   npm install
   ```

3. Copy env file
   ```bash
   mv .env.template .env.local
   ```

4. Setup a new project with Google [Firebase](https://firebase.google.com/) and enable firestore, authentication and analytics.
   Go into settings and add a web application, you will get the necessasary keys. Add them to the `.env.local`

5. Run the project
   ```
   npm run dev
   ```
   the app will be available at http://localhost:3000

---

A product of [weeblabs](https://weeblabs.com)
import{sessionManager as s}from"./session-manager.js";document.addEventListener("DOMContentLoaded",async()=>{const e=document.querySelector(".hero-section").querySelector(".container");if(s.loadTokens())try{const n=await s.getCurrentUser();n?c(n.username,e):o(e)}catch{o(e)}else o(e)});function c(t,e){e.innerHTML=`
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <div class="text-center mb-4">
                    <img src="/static/svg/cypher.svg" alt="Cypher" style="height: 120px; width: auto;">
                </div>
                <div class="text-center mb-4">
                    <h2 class="text-light mb-3">Welcome back, ${a(t)}!</h2>
                    <p class="hero-subtitle">Your secure session is active</p>
                </div>
                <div class="hero-buttons d-flex justify-content-center">
                    <button id="logout-btn" class="btn btn-outline-light btn-lg" style="min-width: 150px; height: 48px;">
                        <i class="bi bi-box-arrow-right me-2"></i>Logout
                    </button>
                </div>
            </div>
        </div>
        
        <div class="row mt-5 pt-5">
            <div class="col-lg-8 mx-auto">
                <div class="glass-card p-4">
                    <div class="row text-center">
                        <div class="col-md-4">
                            <div class="mb-3">
                                <i class="bi bi-shield-check text-success" style="font-size: 2rem;"></i>
                            </div>
                            <h6 class="text-light">authenticated</h6>
                            <p class="text-secondary small mb-0">opaque protocol</p>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <i class="bi bi-key text-primary" style="font-size: 2rem;"></i>
                            </div>
                            <h6 class="text-light">session active</h6>
                            <p class="text-secondary small mb-0">paseto tokens</p>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <i class="bi bi-clock text-info" style="font-size: 2rem;"></i>
                            </div>
                            <h6 class="text-light">auto refresh</h6>
                            <p class="text-secondary small mb-0">seamless experience</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;const i=document.getElementById("logout-btn");i&&i.addEventListener("click",l)}function o(t){t.innerHTML=`
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <div class="text-center mb-4">
                    <img src="/static/svg/cypher.svg" alt="Cypher" style="height: 120px; width: auto;">
                </div>
                <p class="hero-subtitle">Next-generation authentication platform with zero-knowledge security</p>
                <div class="hero-buttons">
                    <a href="/api/login" class="btn btn-outline-light btn-lg" style="min-width: 150px; height: 48px; display: inline-flex; align-items: center; justify-content: center;">Sign In</a>
                    <a href="/api/register" class="btn btn-primary btn-lg glow" style="min-width: 150px; height: 48px; display: inline-flex; align-items: center; justify-content: center;">Get Started</a>
                </div>
            </div>
        </div>
        
        <div class="row mt-5 pt-5">
            <div class="col-lg-8 mx-auto">
                <div class="glass-card p-4 text-center">
                    <p class="text-secondary mb-0">
                        built with the opaque protocol your password never leaves your device
                    </p>
                </div>
            </div>
        </div>
    `}async function l(){const t=document.getElementById("logout-btn");if(t){t.innerHTML,t.disabled=!0,t.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Logging out...';try{await s.logout(),t.innerHTML='<i class="bi bi-check-circle me-2"></i>logged out',setTimeout(()=>{window.location.reload()},1e3)}catch{s.clearSession(),t.innerHTML='<i class="bi bi-exclamation-triangle me-2"></i>logged out',setTimeout(()=>{window.location.reload()},1e3)}}}function a(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}

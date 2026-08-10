(() => {
  const SUPABASE_URL = 'https://cbaetwvmgfvyibzkwznb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_hdoHhkqy-GMXC2wzXdiaA_XSObSmTX';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const SYNC_KEY = 'star_tools_sync_snapshot_v1';

  const style = document.createElement('style');
  style.textContent = `
    #syncBtn{border:1px solid var(--line);background:linear-gradient(135deg,var(--primary),#9968ff);color:#fff;border-radius:12px;padding:9px 13px;font-weight:700}
    #syncPanel{position:fixed;inset:0;z-index:300;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(0,0,0,.75)}
    #syncPanel.open{display:flex}.syncBox{width:min(480px,100%);background:linear-gradient(145deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:0 30px 100px #0009}
    .syncBox h2{margin-top:0}.syncBox input{direction:ltr;text-align:left}.syncActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.syncMsg{padding:10px;border-radius:12px;background:var(--bg);color:var(--muted);margin:10px 0;line-height:1.8;text-align:center}.syncClose{width:100%;margin-top:8px;border:0;border-radius:11px;padding:10px;background:var(--card2);color:var(--text)}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'syncPanel';
  panel.innerHTML = `<div class="syncBox" dir="rtl">
    <h2>☁️ همگام‌سازی Star Tools</h2>
    <div id="syncLoggedOut">
      <p class="muted">با یک حساب، تنظیمات و اطلاعات ذخیره‌شده Star Tools را روی موبایل‌های دیگر هم داشته باش.</p>
      <input id="syncEmail" type="email" autocomplete="email" placeholder="ایمیل">
      <input id="syncPassword" type="password" autocomplete="current-password" placeholder="رمز عبور">
      <div class="syncActions"><button class="action" id="syncLogin">ورود</button><button class="action" id="syncSignup">ثبت‌نام</button></div>
    </div>
    <div id="syncLoggedIn" class="hidden">
      <div class="syncMsg" id="syncUser"></div>
      <button class="action" id="syncNow" style="width:100%">🔄 همگام‌سازی الآن</button>
      <button class="syncClose" id="syncLogout">خروج از حساب</button>
    </div>
    <div class="syncMsg" id="syncStatus">برای همگام‌سازی وارد حساب شو.</div>
    <button class="syncClose" id="syncClose">بستن</button>
  </div>`;
  document.body.appendChild(panel);

  const $ = id => document.getElementById(id);
  const snapshot = () => {
    const out = {};
    for (let i=0;i<localStorage.length;i++) {
      const k=localStorage.key(i);
      if (k && k !== SYNC_KEY) out[k]=localStorage.getItem(k);
    }
    return out;
  };
  const restore = data => {
    if (!data || typeof data !== 'object') return;
    Object.entries(data).forEach(([k,v]) => { try { localStorage.setItem(k, String(v)); } catch(e){} });
    localStorage.setItem(SYNC_KEY, JSON.stringify(data));
  };
  const status = msg => { if ($('syncStatus')) $('syncStatus').textContent=msg; };

  async function syncNow(preferRemote=false){
    const {data:{user}} = await sb.auth.getUser();
    if (!user) return status('ابتدا وارد حساب شو.');
    status('در حال همگام‌سازی...');
    const local = snapshot();
    const {data:remoteRow,error:readError}=await sb.from('star_tools_sync').select('data,updated_at').eq('user_id',user.id).maybeSingle();
    if (readError) return status('خطا در خواندن اطلاعات ابری: '+readError.message);
    if (remoteRow && remoteRow.data && preferRemote) {
      restore(remoteRow.data);
      status('اطلاعات ابری روی این دستگاه بازیابی شد. صفحه را تازه کن.');
      return;
    }
    const merged = {...(remoteRow?.data||{}), ...local};
    const {error}=await sb.from('star_tools_sync').upsert({user_id:user.id,data:merged,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if (error) return status('خطا در ذخیره ابری: '+error.message);
    restore(merged);
    status('✅ اطلاعات روی Supabase ذخیره و همگام شد.');
  }

  function openPanel(){panel.classList.add('open'); refreshUser();}
  function closePanel(){panel.classList.remove('open');}
  async function refreshUser(){
    const {data:{session}}=await sb.auth.getSession();
    $('syncLoggedOut').classList.toggle('hidden',!!session);
    $('syncLoggedIn').classList.toggle('hidden',!session);
    if(session){ $('syncUser').textContent='وارد شده با: '+(session.user.email||session.user.id); status('حساب آماده است.'); }
  }

  async function login(){
    const email=$('syncEmail').value.trim(), password=$('syncPassword').value;
    if(!email||!password)return status('ایمیل و رمز عبور را وارد کن.');
    status('در حال ورود...');
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error)return status('ورود ناموفق: '+error.message);
    await refreshUser(); await syncNow(false);
  }
  async function signup(){
    const email=$('syncEmail').value.trim(), password=$('syncPassword').value;
    if(!email||password.length<6)return status('ایمیل معتبر و رمز حداقل ۶ کاراکتری وارد کن.');
    status('در حال ساخت حساب...');
    const {data,error}=await sb.auth.signUp({email,password});
    if(error)return status('ثبت‌نام ناموفق: '+error.message);
    if(!data.session){status('حساب ساخته شد. ایمیل تأیید را بررسی کن و سپس وارد شو.');return;}
    await refreshUser(); await syncNow(false);
  }
  async function logout(){await sb.auth.signOut();await refreshUser();status('از حساب خارج شدی.');}

  // Add a sync button to the existing navigation without changing the site's layout.
  const nav=document.querySelector('.nav');
  if(nav){const b=document.createElement('button');b.id='syncBtn';b.textContent='☁️ همگام‌سازی';b.onclick=openPanel;nav.insertBefore(b,nav.firstChild);}
  $('syncClose').onclick=closePanel;
  $('syncLogin').onclick=login; $('syncSignup').onclick=signup; $('syncNow').onclick=()=>syncNow(true); $('syncLogout').onclick=logout;
  $('syncPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});

  sb.auth.onAuthStateChange(async (_event,session)=>{
    $('syncLoggedOut').classList.toggle('hidden',!!session);
    $('syncLoggedIn').classList.toggle('hidden',!session);
    if(session){$('syncUser').textContent='وارد شده با: '+(session.user.email||session.user.id); await syncNow(false);}
  });

  // Save changes to localStorage to the cloud shortly after the app changes them.
  let timer;
  const originalSet=localStorage.setItem.bind(localStorage);
  localStorage.setItem=(k,v)=>{originalSet(k,v); if(k!==SYNC_KEY){clearTimeout(timer);timer=setTimeout(()=>syncNow(false),1200)}};
})();

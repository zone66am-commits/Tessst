import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const configured = firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID" && ADMIN_EMAIL !== "YOUR_ADMIN_EMAIL@example.com";

let app, auth, db;
let channels = [];

function msg(el, text, type='') { el.textContent=text; el.className='msg '+type; }
function toast(text, ok=true){ const t=$('toast'); t.textContent=text; t.className='toast show '+(ok?'ok':'bad'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.className='toast',2800); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

if(!configured){
  msg($('loginMsg'),'أولاً افتح firebase-config.js وضع بيانات Firebase والبريد الإداري.','bad');
  $('loginForm').querySelector('button').disabled=true;
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

$('loginForm').addEventListener('submit', async e=>{
  e.preventDefault();
  if(!configured) return;
  msg($('loginMsg'),'جاري تسجيل الدخول...');
  try{
    const cred = await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);
    if((cred.user.email||'').toLowerCase() !== ADMIN_EMAIL.toLowerCase()){
      await signOut(auth); throw new Error('هذا الحساب ليس حساب المدير.');
    }
  }catch(err){ msg($('loginMsg'),friendlyError(err),'bad'); }
});

$('logout').onclick=()=>signOut(auth);

if (configured) onAuthStateChanged(auth, async user=>{
  if(!user){ $('loginView').classList.remove('hidden'); $('appView').classList.add('hidden'); return; }
  if((user.email||'').toLowerCase() !== ADMIN_EMAIL.toLowerCase()){ await signOut(auth); return; }
  $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden');
  await loadChannels();
});

async function loadChannels(){
  try{
    const snap=await getDocs(query(collection(db,'channels'),orderBy('sortOrder','asc')));
    channels=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  }catch(err){ $('list').innerHTML='<div class="empty">تعذر تحميل القنوات. تأكد من Firestore Rules.</div>'; toast(friendlyError(err),false); }
}

function render(){
  $('total').textContent=channels.length;
  $('active').textContent=channels.filter(c=>c.active!==false).length;
  $('disabled').textContent=channels.filter(c=>c.active===false).length;
  const q=$('search').value.trim().toLowerCase(), f=$('filter').value;
  const list=channels.filter(c=>(!q || (c.name||'').toLowerCase().includes(q)) && (f==='all'||c.category===f));
  if(!list.length){ $('list').innerHTML='<div class="empty">ماكو قنوات مطابقة.</div>'; return; }
  $('list').innerHTML=list.map(c=>`<article class="channel ${c.active===false?'off':''}">
    <div class="channelIcon">TV</div><div class="channelInfo"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.category||'أخرى')} · ترتيب ${Number(c.sortOrder||0)}</span><small>${escapeHtml(c.url||'')}</small></div>
    <div class="channelActions"><button class="edit" data-id="${c.id}">تعديل</button><button class="toggle" data-id="${c.id}">${c.active===false?'تفعيل':'إيقاف'}</button><button class="delete" data-id="${c.id}">حذف</button></div>
  </article>`).join('');
  document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>editChannel(b.dataset.id));
  document.querySelectorAll('.toggle').forEach(b=>b.onclick=()=>toggleChannel(b.dataset.id));
  document.querySelectorAll('.delete').forEach(b=>b.onclick=()=>removeChannel(b.dataset.id));
}

$('search').oninput=render; $('filter').onchange=render;

$('channelForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('channelId').value || ('channel_'+Date.now());
  const data={name:$('name').value.trim(),url:$('url').value.trim(),category:$('category').value,sortOrder:Number($('sortOrder').value||0),active:$('active').checked,updatedAt:Date.now()};
  if(!data.name || !data.url) return;
  try{
    await setDoc(doc(db,'channels',id),data,{merge:true});
    toast('تم حفظ القناة'); resetForm(); await loadChannels();
  }catch(err){ msg($('saveMsg'),friendlyError(err),'bad'); }
});

function editChannel(id){
  const c=channels.find(x=>x.id===id); if(!c)return;
  $('channelId').value=c.id; $('name').value=c.name||''; $('url').value=c.url||''; $('category').value=c.category||'أخرى'; $('sortOrder').value=c.sortOrder||0; $('active').checked=c.active!==false;
  $('formTitle').textContent='تعديل القناة'; $('cancelEdit').classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'});
}
$('cancelEdit').onclick=resetForm; $('resetForm').onclick=resetForm;
function resetForm(){ $('channelForm').reset(); $('channelId').value=''; $('sortOrder').value=0; $('active').checked=true; $('formTitle').textContent='إضافة قناة'; $('cancelEdit').classList.add('hidden'); msg($('saveMsg'),''); }

async function toggleChannel(id){
  const c=channels.find(x=>x.id===id); if(!c)return;
  try{ await setDoc(doc(db,'channels',id),{active:c.active===false,updatedAt:Date.now()},{merge:true}); await loadChannels(); toast(c.active===false?'تم تفعيل القناة':'تم إيقاف القناة'); }
  catch(err){toast(friendlyError(err),false)}
}
async function removeChannel(id){
  const c=channels.find(x=>x.id===id); if(!c)return;
  if(!confirm(`حذف قناة «${c.name}»؟`)) return;
  try{ await deleteDoc(doc(db,'channels',id)); await loadChannels(); toast('تم حذف القناة'); }
  catch(err){toast(friendlyError(err),false)}
}

$('seedBtn').onclick=async()=>{
  if(!confirm('سيتم استيراد القنوات الموجودة حالياً داخل TREMAL X إلى Firestore. القنوات الموجودة بنفس المعرّف سيتم تحديثها. متابعة؟')) return;
  const btn=$('seedBtn'); btn.disabled=true; btn.textContent='جاري الاستيراد...';
  try{
    const data=await fetch('channels.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('تعذر قراءة channels.json');return r.json()});
    for(let i=0;i<data.length;i+=450){
      const batch=writeBatch(db);
      data.slice(i,i+450).forEach((c,j)=>batch.set(doc(db,'channels',`channel_${String(i+j+1).padStart(4,'0')}`),{...c,updatedAt:Date.now()},{merge:true}));
      await batch.commit();
    }
    await loadChannels(); toast(`تم استيراد ${data.length} قناة`);
  }catch(err){toast(friendlyError(err),false)}
  finally{btn.disabled=false;btn.textContent='استيراد القنوات الحالية';}
};

function friendlyError(err){
  const code=err?.code||'';
  if(code.includes('auth/invalid-credential')||code.includes('auth/wrong-password')) return 'البريد أو كلمة المرور غير صحيحة.';
  if(code.includes('permission-denied')) return 'ما عندك صلاحية. راجع Firestore Rules والبريد الإداري.';
  if(code.includes('failed-precondition')) return 'تأكد من إعداد Firestore بشكل صحيح.';
  return err?.message || 'حدث خطأ غير متوقع.';
}

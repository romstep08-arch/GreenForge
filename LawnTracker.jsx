import { useState, useRef, useEffect } from "react";

/* ─── Constants ─── */
const GRASS_TYPES = ["Bermuda","Kentucky Bluegrass","Zoysia","St. Augustine","Tall Fescue","Ryegrass","Centipede"];
const FREQ_OPTIONS = [{label:"Weekly",days:7},{label:"Every 10 days",days:10},{label:"Biweekly",days:14},{label:"Every 3 weeks",days:21},{label:"Monthly",days:30}];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const STATE_ZONE = {FL:"south",GA:"south",SC:"south",AL:"south",MS:"south",LA:"south",TX:"south",AR:"south",HI:"south",VA:"transition",WV:"transition",KY:"transition",TN:"transition",NC:"transition",OK:"transition",NM:"transition",AZ:"transition",MD:"transition",DE:"transition",NJ:"transition",CA:"transition"};
const EQUIP_CATS = ["Mower","Trimmer","Blower","Edger","Sprayer","Other"];
const MAINT_TASKS = {Mower:["Oil Change","Air Filter","Blade Sharpening","Spark Plug","Belt Inspection"],Trimmer:["Head Replacement","Line Reload","Air Filter","Spark Plug"],Blower:["Air Filter","Spark Plug","Fuel Line Check"],Edger:["Blade Replacement","Air Filter"],Sprayer:["Nozzle Cleaning","Tank Inspection","Seal Check"],Other:["Inspection","Lubrication","Replacement"]};
const WEATHER = {
  location:"Omaha, NE",
  today:{temp:74,humidity:52,windSpeed:9,condition:"Partly Cloudy",rainChance:10,icon:"⛅"},
  forecast:[
    {day:"Today",condition:"Partly Cloudy",high:74,low:58,rain:10,mow:87,icon:"⛅",bestWindow:"7:30–10:00 AM",advisory:"Early morning before afternoon cloud cover rolls in."},
    {day:"Wed",  condition:"Sunny",         high:79,low:62,rain:0, mow:95,icon:"☀️",bestWindow:"7:00–10:30 AM",advisory:"Best day this week — mow early before temps climb past 80°."},
    {day:"Thu",  condition:"Thunderstorms", high:68,low:57,rain:85,mow:8, icon:"⛈️",bestWindow:null,          advisory:"Skip — heavy storms. Wet grass tears and clogs the mower."},
    {day:"Fri",  condition:"Overcast",      high:65,low:54,rain:35,mow:48,icon:"🌥️",bestWindow:"10:00 AM–12 PM",advisory:"Possible afternoon showers. Finish before noon."},
    {day:"Sat",  condition:"Sunny",         high:78,low:61,rain:5, mow:93,icon:"☀️",bestWindow:"7:00–10:00 AM",advisory:"Excellent weekend conditions — get out early."},
    {day:"Sun",  condition:"Rainy",         high:66,low:55,rain:70,mow:15,icon:"🌧️",bestWindow:null,          advisory:"Skip — steady rain all day. Wait until Monday."},
    {day:"Mon",  condition:"Partly Cloudy", high:72,low:58,rain:20,mow:78,icon:"⛅",bestWindow:"8:00–11:00 AM",advisory:"Good rebound after weekend rain. Morning mow recommended."},
  ],
};

let nextLawnId=4, nextEquipId=3, nextCrewId=3, nextJournalId=20, nextInvoiceNum=1004;
const G="#2D5C20", DARK="#1D2E1A";
const todayStr = ()=>new Date().toISOString().split("T")[0];
const daysAgo  = n=>new Date(Date.now()-n*86400000).toISOString().split("T")[0];
const fmtDate  = d=>new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtMoney = v=>`$${Number(v||0).toFixed(0)}`;

function daysSince(ds){const[y,m,d]=ds.split("-").map(Number);return Math.floor((Date.now()-new Date(y,m-1,d))/86400000);}
function healthPct(l){return Math.min(daysSince(l.lastMowed)/l.frequency,1.2);}
function healthColor(p){return p<0.55?"#4CAF50":p<0.9?"#F59E0B":"#EF4444";}
function healthLabel(p){return p<0.55?"Healthy":p<0.9?"Mow Soon":"Overdue";}
function scoreColor(s){return s>=75?"#4CAF50":s>=45?"#F59E0B":"#EF4444";}
function mockDist(l){return Math.abs((l.lat-41.26)*111)+Math.abs((l.lng+96.01)*85);}

function getCareCalendar(grassType,stateCode){
  const zone=STATE_ZONE[stateCode]||"north";
  const warm=["Bermuda","Zoysia","St. Augustine","Centipede"].includes(grassType);
  if(warm)return[{icon:"🌱",label:"Seeding",value:zone==="south"?"April–June":"May–July"},{icon:"💊",label:"Fertilizing",value:"March–Aug (every 6 wks)"},{icon:"🔧",label:"Aeration",value:"June–August"},{icon:"📌",label:"Tip",value:"Warm-season — peak growth in summer heat."}];
  return[{icon:"🌱",label:"Seeding",value:zone==="north"?"Late Aug–September":"Sept–October"},{icon:"💊",label:"Fertilizing",value:"Sept–Nov (main) · Mar–Apr (light)"},{icon:"🔧",label:"Aeration",value:"Early September or early spring"},{icon:"📌",label:"Tip",value:"Cool-season — peak growth in fall and spring."}];
}

function getSeasonalReminders(lawns){
  const month=new Date().getMonth()+1;
  const out=[];
  lawns.forEach(l=>{
    const warm=["Bermuda","Zoysia","St. Augustine","Centipede"].includes(l.grassType);
    if(!warm&&(month===8||month===9))out.push({id:l.id,name:l.name,msg:`Time to overseed your ${l.grassType}!`,icon:"🌱"});
    if(!warm&&month===9)out.push({id:l.id,name:l.name,msg:`Fall fertilizer window open for ${l.grassType}.`,icon:"💊"});
    if(warm&&(month===4||month===5))out.push({id:l.id,name:l.name,msg:`Good time to seed ${l.grassType} in ${l.state||"your area"}.`,icon:"🌱"});
    if(warm&&month===5)out.push({id:l.id,name:l.name,msg:`Start fertilizing ${l.grassType} — peak season begins.`,icon:"💊"});
  });
  return out;
}

/* ─── Shared UI ─── */
const lSty={display:"block",fontSize:11,fontWeight:700,color:"#8A9280",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"};
const iSty={width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #DDE2D8",fontSize:15,color:"#1A1E16",background:"#FAFAF8",marginBottom:18,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
const Label=({children})=><label style={lSty}>{children}</label>;
const Inp=(props)=><input {...props} style={iSty}/>;
const Chip=({children,active,onClick,sm})=><button onClick={onClick} style={{padding:sm?"5px 10px":"8px 14px",borderRadius:20,border:`2px solid ${active?G:"#DDE2D8"}`,background:active?G:"transparent",color:active?"#fff":"#1A1E16",cursor:"pointer",fontSize:sm?11:13,fontWeight:600}}>{children}</button>;
const Divider=({children})=><div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0 18px"}}><span style={{fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{children}</span><div style={{flex:1,height:1,background:"#EEF0EA"}}/></div>;
const SLabel=({children})=><p style={{margin:"0 0 12px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.08em"}}>{children}</p>;
const Card=({children,mb=10,p="14px 16px"})=><div style={{background:"#fff",borderRadius:14,padding:p,marginBottom:mb,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>{children}</div>;
const TBtn=({children,onClick,color})=><button onClick={onClick} style={{flex:1,padding:"13px 0",background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color}}>{children}</button>;

function HealthBar({pct}){return <div style={{background:"#F0F0EC",borderRadius:99,height:6,overflow:"hidden"}}><div style={{width:`${Math.min(pct*100,100)}%`,height:"100%",background:healthColor(pct),borderRadius:99,transition:"width 0.4s"}}/></div>;}

function ScoreRing({score,size=90}){
  const r=(size-14)/2,circ=2*Math.PI*r,arc=circ*0.75,filled=(score/100)*arc,col=scoreColor(score);
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="9" strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(135 ${size/2} ${size/2})`}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="9" strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(135 ${size/2} ${size/2})`}/><text x={size/2} y={size/2-3} textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="800" fill="#fff">{score}</text><text x={size/2} y={size/2+13} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)" fontWeight="600">MOW SCORE</text></svg>);
}

function Sheet({onClose,children,title,full}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",zIndex:300}}>
      <div style={{background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:"22px 20px 32px",maxHeight:full?"95vh":"88vh",overflowY:"auto",maxWidth:430,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#1A1E16"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#6B7261"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Mow Photo Modal ─── */
function MowPhotoModal({lawnName,onConfirm,onClose}){
  const [preview,setPreview]=useState(null);
  const fileRef=useRef();
  const handleFile=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);};
  return(
    <Sheet title="Mow Complete 🎉" onClose={onClose}>
      <p style={{margin:"-8px 0 18px",fontSize:13,color:"#8A9280"}}>Add a photo of <b>{lawnName}</b> to confirm.</p>
      {preview
        ?<div style={{marginBottom:16,borderRadius:14,overflow:"hidden",height:200,position:"relative"}}><img src={preview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={()=>setPreview(null)} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",color:"#fff",border:"none",borderRadius:99,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>Retake</button></div>
        :<div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #C8D4C4",borderRadius:14,padding:"36px 0",textAlign:"center",marginBottom:16,cursor:"pointer",background:"#F6F8F5"}}><p style={{margin:"0 0 6px",fontSize:36}}>📷</p><p style={{margin:0,fontSize:15,fontWeight:700,color:G}}>Add Photo</p><p style={{margin:"4px 0 0",fontSize:12,color:"#8A9280"}}>Opens camera on mobile</p></div>
      }
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFile}/>
      <button onClick={()=>onConfirm(preview)} disabled={!preview} style={{width:"100%",padding:14,background:preview?G:"#B0C8AE",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:800,cursor:preview?"pointer":"default",marginBottom:10}}>✓ Confirm Mow</button>
      <button onClick={()=>onConfirm(null)} style={{width:"100%",padding:12,background:"none",border:"none",color:"#8A9280",fontSize:14,cursor:"pointer"}}>Skip photo</button>
    </Sheet>
  );
}

/* ─── AI Chat ─── */
function ChatModal({lawns,onClose}){
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Hey! I'm your GreenForge lawn advisor. Ask me anything — mowing height, fertilizing, pest control, grass health, or your business. 🌿"}]);
  const [input,setInput]=useState(""); const [loading,setLoading]=useState(false);
  const bottomRef=useRef();
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);
  const send=async()=>{
    if(!input.trim()||loading)return;
    const userMsg={role:"user",content:input.trim()};
    setMsgs(m=>[...m,userMsg]);setInput("");setLoading(true);
    try{
      const ctx=lawns.map(l=>`- ${l.name}: ${l.grassType}, ${(l.size||0).toLocaleString()} sq ft, ${l.state||"NE"}, mowed ${daysSince(l.lastMowed)}d ago, every ${l.frequency}d${Number(l.pricePerMow)>0?`, $${l.pricePerMow}/mow`:""}`).join("\n")||"No lawns yet.";
      const sys=`You are a friendly expert lawn care advisor in GreenForge. Give concise practical advice (2-4 sentences). User's lawns:\n${ctx}`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:sys,messages:[...msgs,userMsg].map(m=>({role:m.role,content:m.content}))})});
      const data=await res.json();
      setMsgs(m=>[...m,{role:"assistant",content:data.content?.[0]?.text||"Sorry, try again."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",content:"Connection error. Please try again."}]);}
    setLoading(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"#EEF0EA",display:"flex",flexDirection:"column",zIndex:400,maxWidth:430,margin:"0 auto"}}>
      <div style={{background:DARK,color:"#fff",padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div><p style={{margin:"0 0 1px",fontSize:10,opacity:0.5,fontWeight:800,letterSpacing:"0.1em"}}>GREENFORGE</p><h2 style={{margin:0,fontSize:18,fontWeight:800}}>Lawn Advisor AI</h2></div>
        <span style={{marginLeft:"auto",fontSize:22}}>🌿</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {msgs.map((msg,i)=>(
          <div key={i} style={{marginBottom:12,display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
            {msg.role==="assistant"&&<span style={{fontSize:18,flexShrink:0}}>🌿</span>}
            <div style={{maxWidth:"80%",padding:"11px 15px",borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:msg.role==="user"?G:"#fff",color:msg.role==="user"?"#fff":"#1A1E16",fontSize:14,lineHeight:1.55,boxShadow:msg.role==="assistant"?"0 1px 4px rgba(0,0,0,0.07)":"none"}}>{msg.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:12}}><span style={{fontSize:18}}>🌿</span><div style={{background:"#fff",padding:"12px 16px",borderRadius:"18px 18px 18px 4px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><div style={{display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#B0C0A8",animation:"dot 1.2s ease-in-out infinite",animationDelay:`${i*0.18}s`}}/>)}</div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"12px 16px 16px",background:"#fff",borderTop:"1px solid #E8EAE4",display:"flex",gap:10}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about your lawn…" style={{flex:1,padding:"12px 16px",borderRadius:24,border:"2px solid #DDE2D8",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={send} disabled={!input.trim()||loading} style={{width:46,height:46,borderRadius:"50%",background:input.trim()&&!loading?G:"#B0C8AE",border:"none",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
      </div>
    </div>
  );
}

/* ─── Journal Modal ─── */
function JournalModal({lawn,onSave,onClose}){
  const [entries,setEntries]=useState(lawn.journal||[]);
  const [text,setText]=useState(""); const [photo,setPhoto]=useState(null);
  const fileRef=useRef();
  const addEntry=()=>{
    if(!text.trim())return;
    const e={id:nextJournalId++,date:todayStr(),text:text.trim(),photo};
    const next=[e,...entries]; setEntries(next); onSave(next); setText(""); setPhoto(null);
  };
  return(
    <Sheet title={`📓 Journal — ${lawn.name}`} onClose={onClose} full>
      <div style={{marginBottom:16,background:"#F6F8F5",borderRadius:12,padding:14}}>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Log an observation, issue, or note…" rows={3} style={{...iSty,resize:"none",marginBottom:10,fontFamily:"inherit"}}/>
        {photo&&<div style={{borderRadius:10,overflow:"hidden",height:90,marginBottom:10,position:"relative"}}><img src={photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={()=>setPhoto(null)} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.5)",color:"#fff",border:"none",borderRadius:99,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>✕</button></div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>fileRef.current.click()} style={{flex:1,padding:10,background:"#fff",border:"2px solid #DDE2D8",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",color:"#5A6B50"}}>📷 Photo</button>
          <button onClick={addEntry} style={{flex:2,padding:10,background:text.trim()?G:"#B0C8AE",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add Entry</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPhoto(ev.target.result);r.readAsDataURL(f);}}/>
      </div>
      {entries.length===0?<p style={{textAlign:"center",color:"#8A9280",fontSize:13,padding:"24px 0"}}>No journal entries yet.</p>
        :entries.map(e=>(
          <div key={e.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <p style={{margin:"0 0 4px",fontSize:11,color:"#8A9280",fontWeight:700}}>{fmtDate(e.date)}</p>
            <p style={{margin:"0 0 8px",fontSize:14,color:"#1A1E16",lineHeight:1.5}}>{e.text}</p>
            {e.photo&&<div style={{borderRadius:10,overflow:"hidden",height:110}}><img src={e.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
          </div>
        ))
      }
    </Sheet>
  );
}

/* ─── Before / After Modal ─── */
function BeforeAfterModal({lawn,onClose}){
  const withPhoto=(lawn.mowHistory||[]).filter(h=>h.photo);
  const before=withPhoto[1]; const after=withPhoto[0];
  return(
    <Sheet title="📸 Before / After" onClose={onClose}>
      {withPhoto.length<2
        ?<div style={{textAlign:"center",padding:"32px 0",color:"#8A9280"}}><p style={{fontSize:40,margin:"0 0 10px"}}>📸</p><p style={{fontSize:15,fontWeight:700,color:"#1A1E16",margin:"0 0 4px"}}>Need 2 mow photos</p><p style={{fontSize:13,margin:0}}>Add photos when confirming mows to unlock before/after.</p></div>
        :<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div style={{borderRadius:12,overflow:"hidden",border:"2px solid #EF444440"}}><div style={{padding:"6px 10px",background:"#EF444415",textAlign:"center"}}><span style={{fontSize:11,fontWeight:800,color:"#EF4444"}}>BEFORE</span></div><img src={before.photo} alt="" style={{width:"100%",height:170,objectFit:"cover"}}/><p style={{margin:0,padding:"5px 8px",fontSize:10,color:"#8A9280",textAlign:"center"}}>{fmtDate(before.date)}</p></div>
          <div style={{borderRadius:12,overflow:"hidden",border:"2px solid #4CAF5040"}}><div style={{padding:"6px 10px",background:"#4CAF5015",textAlign:"center"}}><span style={{fontSize:11,fontWeight:800,color:"#4CAF50"}}>AFTER</span></div><img src={after.photo} alt="" style={{width:"100%",height:170,objectFit:"cover"}}/><p style={{margin:0,padding:"5px 8px",fontSize:10,color:"#8A9280",textAlign:"center"}}>{fmtDate(after.date)}</p></div>
        </div><p style={{fontSize:12,color:"#8A9280",textAlign:"center",margin:0}}>Showing most recent two mow photos</p></div>
      }
    </Sheet>
  );
}

/* ─── Invoice Modal ─── */
function InvoiceModal({lawn,onClose}){
  const num=`GF-${String(nextInvoiceNum++).padStart(4,"0")}`;
  const mows=Math.max(1,Math.floor(30/lawn.frequency));
  const price=Number(lawn.pricePerMow)||0;
  return(
    <Sheet title="🧾 Invoice" onClose={onClose} full>
      <div style={{background:"#fff",border:"1px solid #EEF0EA",borderRadius:14,overflow:"hidden",marginBottom:18}}>
        <div style={{background:DARK,color:"#fff",padding:"18px 20px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><p style={{margin:"0 0 2px",fontSize:10,opacity:0.5,fontWeight:800,letterSpacing:"0.1em"}}>GREENFORGE LANDSCAPING</p><p style={{margin:"0 0 2px",fontSize:20,fontWeight:800}}>Invoice</p><p style={{margin:0,fontSize:11,opacity:0.6}}>{num}</p></div>
            <div style={{textAlign:"right"}}><p style={{margin:"0 0 2px",fontSize:11,opacity:0.65}}>Date</p><p style={{margin:0,fontSize:13,fontWeight:700}}>{fmtDate(todayStr())}</p></div>
          </div>
        </div>
        <div style={{padding:"16px 20px"}}>
          <p style={{margin:"0 0 8px",fontSize:10,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.07em"}}>Bill To</p>
          <p style={{margin:"0 0 3px",fontSize:15,fontWeight:700,color:"#1A1E16"}}>{lawn.contactName||"Client"}</p>
          {lawn.address&&<p style={{margin:"0 0 3px",fontSize:13,color:"#6B7261"}}>{lawn.address}{lawn.state?`, ${lawn.state}`:""}</p>}
          {lawn.contactPhone&&<p style={{margin:"0 0 3px",fontSize:13,color:"#6B7261"}}>📞 {lawn.contactPhone}</p>}
          {lawn.contactEmail&&<p style={{margin:0,fontSize:13,color:"#6B7261"}}>✉️ {lawn.contactEmail}</p>}
          <div style={{height:1,background:"#EEF0EA",margin:"14px 0"}}/>
          <p style={{margin:"0 0 10px",fontSize:10,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.07em"}}>Services</p>
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #F4F4F0"}}>
            <div><p style={{margin:"0 0 2px",fontSize:14,fontWeight:600,color:"#1A1E16"}}>Lawn Mowing — {lawn.name}</p><p style={{margin:0,fontSize:12,color:"#8A9280"}}>{mows} visits × {fmtMoney(price)}</p></div>
            <p style={{margin:0,fontSize:15,fontWeight:700,color:"#1A1E16"}}>{fmtMoney(price*mows)}</p>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 4px"}}>
            <p style={{margin:0,fontSize:15,fontWeight:800,color:"#1A1E16"}}>Total Due</p>
            <p style={{margin:0,fontSize:26,fontWeight:800,color:G}}>{fmtMoney(price*mows)}</p>
          </div>
          {!price&&<p style={{fontSize:12,color:"#EF4444",margin:"2px 0 0"}}>⚠ No price set — edit lawn to add pricing.</p>}
        </div>
      </div>
      <button onClick={()=>{const b=new Blob([`GREENFORGE LANDSCAPING\n${num}\nDate: ${fmtDate(todayStr())}\n\nBill To:\n${lawn.contactName||"Client"}\n${lawn.address||""}\n${lawn.contactPhone||""}\n\nServices:\nLawn Mowing — ${lawn.name}: ${mows} visits x $${price} = $${price*mows}\n\nTotal Due: $${price*mows}`],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`GreenForge-${num}.txt`;a.click();}} style={{width:"100%",padding:14,background:G,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:10}}>↓ Download Invoice</button>
      <button onClick={onClose} style={{width:"100%",padding:12,background:"none",border:"2px solid #DDE2D8",borderRadius:12,fontSize:14,cursor:"pointer",color:"#5A6B50",fontWeight:600}}>Close</button>
    </Sheet>
  );
}

/* ─── Client Share Modal ─── */
function ShareModal({lawn,onClose}){
  const nextDue=new Date(new Date(lawn.lastMowed+"T00:00:00").getTime()+lawn.frequency*86400000).toISOString().split("T")[0];
  const history=(lawn.mowHistory||[]).slice(0,4);
  const [copied,setCopied]=useState(false);
  const doCopy=()=>{navigator.clipboard?.writeText(`GreenForge — ${lawn.name}\nLast mowed: ${fmtDate(lawn.lastMowed)}\nNext visit: ${fmtDate(nextDue)}\nManaged by GreenForge Landscaping\n📞 531-218-7374`);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  return(
    <Sheet title="🔗 Client View" onClose={onClose} full>
      <p style={{margin:"-8px 0 18px",fontSize:13,color:"#8A9280"}}>Preview what your client sees when you share their lawn status.</p>
      <div style={{background:"#F6F8F5",border:"2px solid #DDE2D8",borderRadius:16,padding:"18px 16px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:40,height:40,borderRadius:12,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🌿</div>
          <div><p style={{margin:"0 0 1px",fontSize:10,fontWeight:800,color:"#8A9280",letterSpacing:"0.08em"}}>GREENFORGE</p><p style={{margin:0,fontSize:17,fontWeight:800,color:"#1A1E16"}}>{lawn.name}</p></div>
        </div>
        {lawn.address&&<p style={{margin:"0 0 12px",fontSize:13,color:"#6B7261"}}>📍 {lawn.address}{lawn.state?`, ${lawn.state}`:""}</p>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div style={{background:"#fff",borderRadius:10,padding:"10px 12px"}}><p style={{margin:"0 0 3px",fontSize:10,fontWeight:700,color:"#8A9280",textTransform:"uppercase"}}>Last Mowed</p><p style={{margin:0,fontSize:14,fontWeight:700,color:"#1A1E16"}}>{fmtDate(lawn.lastMowed)}</p></div>
          <div style={{background:"#fff",borderRadius:10,padding:"10px 12px"}}><p style={{margin:"0 0 3px",fontSize:10,fontWeight:700,color:"#8A9280",textTransform:"uppercase"}}>Next Visit</p><p style={{margin:0,fontSize:14,fontWeight:700,color:G}}>{fmtDate(nextDue)}</p></div>
        </div>
        {lawn.lastMowedPhoto&&<div style={{borderRadius:12,overflow:"hidden",height:150,marginBottom:12}}><img src={lawn.lastMowedPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
        {history.length>0&&<div><p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>Mow History</p>{history.map((h,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<history.length-1?"1px solid #EEF0EA":"none"}}><span style={{fontSize:14}}>✓</span><span style={{fontSize:13,color:"#1A1E16",flex:1}}>{fmtDate(h.date)}</span>{h.photo&&<div style={{width:32,height:32,borderRadius:7,overflow:"hidden"}}><img src={h.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}</div>)}</div>}
      </div>
      <button onClick={doCopy} style={{width:"100%",padding:14,background:copied?"#4CAF50":G,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer"}}>{copied?"✓ Copied!":"🔗 Copy Share Info"}</button>
    </Sheet>
  );
}

/* ─── Lawn Form Modal ─── */
function LawnModal({onSave,onClose,initial,crew}){
  const [form,setForm]=useState(initial||{name:"",grassType:"Bermuda",size:"",frequency:7,lastMowed:todayStr(),notes:"",tag:"Personal",address:"",state:"NE",contactName:"",contactPhone:"",contactEmail:"",pricePerMow:"",crewId:null,lat:41.26,lng:-96.01});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return(
    <Sheet title={initial?"Edit Lawn":"Add Lawn"} onClose={onClose} full>
      <Divider>Lawn Info</Divider>
      <Label>Lawn Name</Label><Inp value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Backyard, Riverside Commerce…"/>
      <Label>Grass Type</Label><select value={form.grassType} onChange={e=>set("grassType",e.target.value)} style={iSty}>{GRASS_TYPES.map(g=><option key={g}>{g}</option>)}</select>
      <Label>Size (sq ft)</Label><Inp type="number" value={form.size} onChange={e=>set("size",e.target.value)} placeholder="e.g. 5000"/>
      <Label>Tag</Label><div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>{["Personal","Residential","Commercial"].map(t=><Chip key={t} active={form.tag===t} onClick={()=>set("tag",t)}>{t}</Chip>)}</div>
      <Divider>Location</Divider>
      <Label>Street Address</Label><Inp value={form.address} onChange={e=>set("address",e.target.value)} placeholder="e.g. 123 Oak St, Omaha"/>
      <Label>State</Label><select value={form.state} onChange={e=>set("state",e.target.value)} style={iSty}>{US_STATES.map(s=><option key={s}>{s}</option>)}</select>
      <Divider>Schedule</Divider>
      <Label>Mow Frequency</Label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{FREQ_OPTIONS.map(f=><Chip key={f.days} active={form.frequency===f.days} onClick={()=>set("frequency",f.days)}>{f.label}</Chip>)}</div>
      <Label>Last Mowed</Label><Inp type="date" value={form.lastMowed} onChange={e=>set("lastMowed",e.target.value)}/>
      <Divider>Pricing & Crew</Divider>
      <Label>Price Per Mow ($)</Label><Inp type="number" value={form.pricePerMow} onChange={e=>set("pricePerMow",e.target.value)} placeholder="e.g. 50"/>
      <Label>Assign Crew Member</Label>
      <select value={form.crewId||""} onChange={e=>set("crewId",e.target.value?Number(e.target.value):null)} style={iSty}>
        <option value="">— Unassigned —</option>
        {crew.map(c=><option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
      </select>
      <Divider>Customer Contact</Divider>
      <Label>Contact Name</Label><Inp value={form.contactName} onChange={e=>set("contactName",e.target.value)} placeholder="e.g. John Smith"/>
      <Label>Phone</Label><Inp type="tel" value={form.contactPhone} onChange={e=>set("contactPhone",e.target.value)} placeholder="531-555-0000"/>
      <Label>Email</Label><Inp type="email" value={form.contactEmail} onChange={e=>set("contactEmail",e.target.value)} placeholder="client@email.com"/>
      <Divider>Notes</Divider>
      <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any additional details…" rows={3} style={{...iSty,resize:"vertical",fontFamily:"inherit"}}/>
      <button onClick={()=>{if(form.name.trim())onSave(form);}} style={{width:"100%",padding:14,background:form.name.trim()?G:"#9AB898",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:800,cursor:"pointer"}}>{initial?"Save Changes":"Add Lawn"}</button>
    </Sheet>
  );
}

/* ─── Dashboard ─── */
function Dashboard({lawns,crew,onMow,onToggleMute}){
  const [selDay,setSelDay]=useState(0);
  const sorted=[...lawns].sort((a,b)=>(a.frequency-daysSince(a.lastMowed))-(b.frequency-daysSince(b.lastMowed)));
  const w=WEATHER.forecast[selDay];
  const WDAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dailyAvg=lawns.filter(l=>Number(l.pricePerMow)>0).reduce((s,l)=>s+(Number(l.pricePerMow)/l.frequency),0);
  const reminders=getSeasonalReminders(lawns);
  return(
    <div style={{padding:"0 16px 16px"}}>
      {reminders.slice(0,2).map((r,i)=>(
        <div key={i} style={{background:"#FFF8E7",border:"1.5px solid #F0C060",borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:20}}>{r.icon}</span>
          <div><p style={{margin:0,fontSize:13,fontWeight:700,color:"#8A6010"}}>{r.name}</p><p style={{margin:0,fontSize:12,color:"#8A6010"}}>{r.msg}</p></div>
        </div>
      ))}
      {/* Day picker */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
        {WEATHER.forecast.map((day,i)=>{
          const d=new Date(Date.now()+i*86400000); const active=selDay===i; const col=scoreColor(day.mow);
          return(<button key={i} onClick={()=>setSelDay(i)} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 12px",borderRadius:14,border:`2px solid ${active?G:"#DDE2D8"}`,background:active?G:"#fff",cursor:"pointer",minWidth:52}}>
            <span style={{fontSize:9,fontWeight:700,color:active?"rgba(255,255,255,0.7)":"#8A9280",textTransform:"uppercase"}}>{i===0?"Today":WDAYS[d.getDay()]}</span>
            <span style={{fontSize:16}}>{day.icon}</span>
            <span style={{fontSize:11,fontWeight:800,color:active?"#fff":col}}>{day.mow}</span>
          </button>);
        })}
      </div>
      {/* Weather hero */}
      <div style={{background:`linear-gradient(135deg,${DARK},${G})`,borderRadius:18,padding:20,marginBottom:18,color:"#fff"}}>
        <p style={{margin:"0 0 2px",fontSize:11,opacity:0.6,fontWeight:700,letterSpacing:"0.08em"}}>{selDay===0?"TODAY":"DAY FORECAST"} · {WEATHER.location}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{margin:"4px 0 2px",fontSize:40,fontWeight:200,lineHeight:1}}>{w.high}°<span style={{fontSize:18}}>F</span></p>
            <p style={{margin:"0 0 10px",fontSize:14,opacity:0.9}}>{w.icon} {w.condition}</p>
            <div style={{fontSize:12,opacity:0.8,display:"flex",flexDirection:"column",gap:3}}>
              <span>🌡 Low: {w.low}°F</span><span>🌧 Rain: {w.rain}%</span>
              {selDay===0&&<span>💨 Wind: {WEATHER.today.windSpeed} mph</span>}
            </div>
          </div>
          <ScoreRing score={w.mow} size={94}/>
        </div>
        <div style={{marginTop:14,background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:5,fontSize:13}}>
          <span>{w.mow>=75?"✅ Great mowing conditions":w.mow>=45?"⚠️ Fair — mow with care":"❌ Not recommended — skip this day"}</span>
          {w.bestWindow?<span style={{fontWeight:700,fontSize:14}}>🕖 Best window: {w.bestWindow}</span>:<span style={{fontWeight:700}}>No good mow window today</span>}
          {w.advisory&&<span style={{opacity:0.8,fontSize:12,lineHeight:1.5}}>{w.advisory}</span>}
        </div>
      </div>
      {/* Earnings snapshot */}
      {dailyAvg>0&&<div style={{display:"flex",gap:8,marginBottom:18}}>{[["Daily",dailyAvg],["Monthly",dailyAvg*30],["Yearly",dailyAvg*365]].map(([label,val])=><div key={label} style={{flex:1,background:"#fff",borderRadius:12,padding:"10px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center"}}><p style={{margin:"0 0 2px",fontSize:9,fontWeight:700,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p><p style={{margin:0,fontSize:16,fontWeight:800,color:G}}>{fmtMoney(val)}</p></div>)}</div>}
      <SLabel>Lawn Status</SLabel>
      {sorted.map(lawn=>{
        const pct=healthPct(lawn); const col=healthColor(pct); const dueIn=lawn.frequency-daysSince(lawn.lastMowed);
        const cm=crew.find(c=>c.id===lawn.crewId);
        return(
          <Card key={lawn.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                  <p style={{margin:0,fontWeight:700,fontSize:15,color:"#1A1E16",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lawn.name}</p>
                  <button onClick={e=>{e.stopPropagation();onToggleMute(lawn.id);}} title={lawn.muted?"Unmute":"Mute"} style={{flexShrink:0,background:lawn.muted?"#FDF0E0":"#EEF0EA",border:`1.5px solid ${lawn.muted?"#D4A574":"#DDE2D8"}`,borderRadius:20,padding:"2px 7px",cursor:"pointer",fontSize:12}}>{lawn.muted?"🔕":"🔔"}</button>
                </div>
                <p style={{margin:"0 0 2px",fontSize:12,color:"#8A9280"}}>{lawn.grassType} · {(lawn.size||0).toLocaleString()} sq ft</p>
                {cm&&<p style={{margin:0,fontSize:11,color:G,fontWeight:600}}>👤 {cm.name}</p>}
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                <span style={{background:col+"22",color:col,fontSize:11,fontWeight:700,borderRadius:20,padding:"3px 10px"}}>{healthLabel(pct)}</span>
                <p style={{margin:"4px 0 0",fontSize:11,color:"#8A9280"}}>{dueIn<=0?`${Math.abs(dueIn)}d overdue`:`Due in ${dueIn}d`}</p>
              </div>
            </div>
            {lawn.muted&&<div style={{marginTop:7,padding:"4px 10px",background:"#FDF6EE",borderRadius:8,fontSize:11,color:"#B07030",fontWeight:600,display:"inline-flex",gap:4}}>🔕 Reminders silenced</div>}
            <div style={{margin:"10px 0"}}><HealthBar pct={pct}/></div>
            {lawn.lastMowedPhoto&&<div style={{borderRadius:10,overflow:"hidden",height:80,marginBottom:10,position:"relative"}}><img src={lawn.lastMowedPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><div style={{position:"absolute",bottom:0,left:0,right:0,padding:"3px 8px",background:"rgba(0,0,0,0.4)",fontSize:10,color:"rgba(255,255,255,0.85)"}}>Last mow photo</div></div>}
            <button onClick={()=>onMow(lawn.id)} style={{width:"100%",padding:9,background:"#F4F6F2",border:"2px solid #DDE2D8",borderRadius:9,fontSize:13,fontWeight:700,color:G,cursor:"pointer"}}>✓ Mark as Mowed Today</button>
          </Card>
        );
      })}
      {!lawns.length&&(
        <div style={{margin:"8px 0 0",background:"#fff",borderRadius:18,padding:"32px 24px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <p style={{fontSize:52,margin:"0 0 14px"}}>🌿</p>
          <p style={{margin:"0 0 6px",fontSize:17,fontWeight:800,color:"#1A1E16"}}>No lawns yet</p>
          <p style={{margin:"0 0 20px",fontSize:13,color:"#8A9280",lineHeight:1.55}}>Head to the Lawns tab to add your first lawn and start tracking your mow schedule.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,textAlign:"left"}}>
            {[["1","Add your lawn","Name, grass type, size, and address"],["2","Set your schedule","Weekly, biweekly, or custom frequency"],["3","Track and earn","Log mows, photos, and get paid"]].map(([n,t,s])=>(
              <div key={n} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 14px",background:"#F6F8F5",borderRadius:12}}>
                <div style={{width:28,height:28,borderRadius:8,background:G,color:"#fff",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
                <div><p style={{margin:"0 0 2px",fontSize:13,fontWeight:700,color:"#1A1E16"}}>{t}</p><p style={{margin:0,fontSize:11,color:"#8A9280"}}>{s}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lawns Tab ─── */
function LawnList({lawns,crew,onMow,onAdd,onEdit,onDelete,onToggleMute,onJournal,onBeforeAfter,onInvoice,onShare}){
  const [expandedId,setExpandedId]=useState(null);
  const toggle=id=>setExpandedId(v=>v===id?null:id);
  return(
    <div style={{padding:"0 16px 16px"}}>
      <button onClick={onAdd} style={{width:"100%",padding:14,background:G,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:16}}>+ Add Lawn</button>
      {!lawns.length&&(
        <div style={{textAlign:"center",padding:"40px 24px"}}>
          <p style={{fontSize:52,margin:"0 0 14px"}}>🌱</p>
          <p style={{fontSize:17,fontWeight:800,margin:"0 0 6px",color:"#1A1E16"}}>Add your first lawn</p>
          <p style={{fontSize:13,margin:"0 0 24px",color:"#8A9280",lineHeight:1.55}}>Tap the button above to add a lawn. You can add as many as you need — great for managing multiple client properties.</p>
        </div>
      )}
      {lawns.map(lawn=>{
        const pct=healthPct(lawn); const col=healthColor(pct); const days=daysSince(lawn.lastMowed);
        const freqLabel=FREQ_OPTIONS.find(f=>f.days===lawn.frequency)?.label||`Every ${lawn.frequency}d`;
        const expanded=expandedId===lawn.id; const care=getCareCalendar(lawn.grassType,lawn.state||"NE");
        const price=Number(lawn.pricePerMow)||0; const cm=crew.find(c=>c.id===lawn.crewId);
        const history=lawn.mowHistory||[];
        return(
          <div key={lawn.id} style={{background:"#fff",borderRadius:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"hidden"}}>
            <div style={{padding:"16px 16px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div onClick={()=>toggle(lawn.id)} style={{flex:1,cursor:"pointer",minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                    <p style={{margin:0,fontWeight:800,fontSize:16,color:"#1A1E16"}}>{lawn.name}</p>
                    <span style={{fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 8px",background:"#EEF0EA",color:"#6B7261"}}>{lawn.tag}</span>
                    {lawn.muted&&<span style={{fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 8px",background:"#FDF0E0",color:"#B07030"}}>🔕</span>}
                  </div>
                  <p style={{margin:0,fontSize:12,color:"#8A9280"}}>{lawn.grassType} · {(lawn.size||0).toLocaleString()} sq ft{cm?` · ${cm.name}`:""}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
                  <button onClick={e=>{e.stopPropagation();onToggleMute(lawn.id);}} style={{background:lawn.muted?"#FDF0E0":"#EEF0EA",border:`1.5px solid ${lawn.muted?"#D4A574":"#DDE2D8"}`,borderRadius:20,padding:"5px 9px",cursor:"pointer",fontSize:14}}>{lawn.muted?"🔕":"🔔"}</button>
                  <div onClick={()=>toggle(lawn.id)} style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span style={{background:col+"22",color:col,fontSize:12,fontWeight:700,borderRadius:20,padding:"4px 12px"}}>{healthLabel(pct)}</span>
                    <span style={{fontSize:12,color:"#8A9280"}}>{expanded?"▲":"▼"}</span>
                  </div>
                </div>
              </div>
              <div onClick={()=>toggle(lawn.id)} style={{cursor:"pointer"}}>
                <div style={{display:"flex",gap:14,margin:"10px 0",fontSize:12,color:"#8A9280",flexWrap:"wrap"}}>
                  <span>🗓 {days}d ago</span><span>🔄 {freqLabel}</span>{price>0&&<span>💵 ${price}/mow</span>}
                </div>
                <HealthBar pct={pct}/>
              </div>
            </div>
            {expanded&&(
              <div style={{borderTop:"1px solid #F0F0EC"}}>
                {/* Quick actions */}
                <div style={{display:"flex",borderBottom:"1px solid #F0F0EC"}}>
                  {[{label:"Journal",icon:"📓",fn:()=>onJournal(lawn)},{label:"Before/After",icon:"📸",fn:()=>onBeforeAfter(lawn)},{label:"Invoice",icon:"🧾",fn:()=>onInvoice(lawn)},{label:"Share",icon:"🔗",fn:()=>onShare(lawn)}].map(({label,icon,fn})=>(
                    <button key={label} onClick={fn} style={{flex:1,padding:"10px 4px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <span style={{fontSize:18}}>{icon}</span><span style={{fontSize:9,fontWeight:700,color:"#5A6B50",textTransform:"uppercase",letterSpacing:"0.03em"}}>{label}</span>
                    </button>
                  ))}
                </div>
                <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                  {lawn.lastMowedPhoto&&<div style={{borderRadius:12,overflow:"hidden",height:130,position:"relative"}}><img src={lawn.lastMowedPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><div style={{position:"absolute",bottom:0,left:0,right:0,padding:"5px 10px",background:"rgba(0,0,0,0.4)",fontSize:11,color:"rgba(255,255,255,0.9)"}}>Last mow photo · {fmtDate(lawn.lastMowed)}</div></div>}
                  {/* Mow history */}
                  {history.length>0&&<div style={{background:"#F8F9F6",borderRadius:10,padding:"12px 14px"}}>
                    <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>Mow History</p>
                    {history.slice(0,5).map((h,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<Math.min(history.length,5)-1?"1px solid #EEF0EA":"none"}}><span>✓</span><span style={{fontSize:13,color:"#1A1E16",flex:1}}>{fmtDate(h.date)}</span>{h.photo&&<div style={{width:32,height:32,borderRadius:7,overflow:"hidden"}}><img src={h.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}</div>)}
                    {history.length>5&&<p style={{margin:"6px 0 0",fontSize:11,color:"#8A9280",textAlign:"center"}}>+{history.length-5} more</p>}
                  </div>}
                  {/* Journal preview */}
                  {(lawn.journal||[]).length>0&&<div style={{background:"#F8F9F6",borderRadius:10,padding:"12px 14px"}}>
                    <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>Latest Journal Entry</p>
                    <p style={{margin:"0 0 2px",fontSize:11,color:"#8A9280"}}>{fmtDate(lawn.journal[0].date)}</p>
                    <p style={{margin:0,fontSize:13,color:"#1A1E16"}}>{lawn.journal[0].text}</p>
                  </div>}
                  {/* Address & contact */}
                  {lawn.address&&<div style={{background:"#F8F9F6",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#1A1E16"}}>📍 {lawn.address}{lawn.state?`, ${lawn.state}`:""}</div>}
                  {(lawn.contactName||lawn.contactPhone||lawn.contactEmail)&&<div style={{background:"#F8F9F6",borderRadius:10,padding:"12px 14px"}}><p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>Customer Contact</p>{lawn.contactName&&<p style={{margin:"0 0 4px",fontSize:13,fontWeight:700,color:"#1A1E16"}}>👤 {lawn.contactName}</p>}{lawn.contactPhone&&<p style={{margin:"0 0 4px",fontSize:13,color:"#1A1E16"}}>📞 {lawn.contactPhone}</p>}{lawn.contactEmail&&<p style={{margin:0,fontSize:13,color:"#1A1E16"}}>✉️ {lawn.contactEmail}</p>}</div>}
                  {/* Earnings */}
                  {price>0&&<div style={{background:"#F0F6F0",borderRadius:10,padding:"12px 14px"}}><p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>Earnings from This Lawn</p><div style={{display:"flex",gap:8}}>{[["Weekly",(7/lawn.frequency)*price],["Monthly",(30/lawn.frequency)*price],["Yearly",(365/lawn.frequency)*price]].map(([lbl,val])=><div key={lbl} style={{flex:1,textAlign:"center",background:"#fff",borderRadius:8,padding:"8px 4px"}}><p style={{margin:"0 0 2px",fontSize:10,color:"#8A9280",fontWeight:700,textTransform:"uppercase"}}>{lbl}</p><p style={{margin:0,fontSize:15,fontWeight:800,color:G}}>{fmtMoney(val)}</p></div>)}</div></div>}
                  {/* Care calendar */}
                  <div style={{background:"#F8F9F6",borderRadius:10,padding:"12px 14px"}}><p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#8A9280",textTransform:"uppercase",letterSpacing:"0.06em"}}>Seasonal Care Calendar</p>{care.map(({icon,label,value})=><div key={label} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:7,fontSize:13}}><span style={{flexShrink:0}}>{icon}</span><span><b style={{color:"#1A1E16"}}>{label}: </b><span style={{color:"#6B7261"}}>{value}</span></span></div>)}</div>
                  {lawn.notes&&<div style={{background:"#F8F9F6",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#1A1E16"}}>📝 {lawn.notes}</div>}
                </div>
                <div style={{display:"flex",borderTop:"1px solid #F0F0EC"}}>
                  <TBtn onClick={()=>onMow(lawn.id)} color={G}>✓ Mowed</TBtn>
                  <div style={{width:1,background:"#F0F0EC"}}/>
                  <TBtn onClick={()=>onEdit(lawn)} color="#5A6B50">✎ Edit</TBtn>
                  <div style={{width:1,background:"#F0F0EC"}}/>
                  <TBtn onClick={()=>onDelete(lawn.id)} color="#EF4444">🗑</TBtn>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Business Tab ─── */
function BusinessTab({lawns,crew,onUpdateCrew,onInvoice,onShare,homeBase,onSetHomeBase}){
  const [sub,setSub]=useState("route");
  const [showAddCrew,setShowAddCrew]=useState(false);
  const [cf,setCf]=useState({name:"",phone:"",role:"Crew"});
  const [editingBase,setEditingBase]=useState(false);
  const [baseInput,setBaseInput]=useState(homeBase);
  const route=[...lawns].sort((a,b)=>mockDist(a)-mockDist(b));
  const addCrew=()=>{if(!cf.name.trim())return;onUpdateCrew([...crew,{id:nextCrewId++,...cf}]);setCf({name:"",phone:"",role:"Crew"});setShowAddCrew(false);};
  const PERIODS=[{id:"day",label:"Day",factor:1/30},{id:"week",label:"Week",factor:1/4.33},{id:"month",label:"Month",factor:1},{id:"year",label:"Year",factor:12}];
  const [period,setPeriod]=useState("month");
  const priced=lawns.filter(l=>Number(l.pricePerMow)>0);
  const factor=PERIODS.find(p=>p.id===period)?.factor||1;
  const calc=l=>(Number(l.pricePerMow)*(30/l.frequency))*factor;
  const total=priced.reduce((s,l)=>s+calc(l),0);
  const maxVal=Math.max(...priced.map(calc),1);

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",background:"#fff",borderRadius:14,padding:4,marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        {[{id:"route",label:"🗺 Route"},{id:"crew",label:"👥 Crew"},{id:"invoices",label:"🧾 Invoices"},{id:"earnings",label:"💵 Earnings"}].map(t=>(
          <button key={t.id} onClick={()=>setSub(t.id)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:sub===t.id?G:"transparent",color:sub===t.id?"#fff":"#8A9280",transition:"all 0.2s"}}>{t.label}</button>
        ))}
      </div>

      {sub==="route"&&(
        <div>
          <Card mb={14}>
            {editingBase?(
              <div>
                <Label>Home Base Address</Label>
                <Inp value={baseInput} onChange={e=>setBaseInput(e.target.value)} placeholder="e.g. 1234 Elm St, Omaha, NE" autoFocus/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{onSetHomeBase(baseInput);setEditingBase(false);}} style={{flex:2,padding:11,background:G,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>Save</button>
                  <button onClick={()=>{setBaseInput(homeBase);setEditingBase(false);}} style={{flex:1,padding:11,background:"none",border:"2px solid #DDE2D8",borderRadius:10,fontSize:14,cursor:"pointer",color:"#6B7261",fontWeight:600}}>Cancel</button>
                </div>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 3px",fontSize:13,fontWeight:700,color:"#1A1E16"}}>📍 {homeBase||"No home base set"}</p>
                  <p style={{margin:0,fontSize:12,color:"#8A9280"}}>Lawns sorted by most efficient driving order.</p>
                </div>
                <button onClick={()=>{setBaseInput(homeBase);setEditingBase(true);}} style={{background:"#EEF0EA",border:"2px solid #DDE2D8",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:"#5A6B50",flexShrink:0,marginLeft:10}}>✎ Edit</button>
              </div>
            )}
          </Card>
          <SLabel>Optimized Order</SLabel>
          {route.map((lawn,i)=>{
            const dist=(mockDist(lawn)*10).toFixed(1); const due=daysSince(lawn.lastMowed)>=lawn.frequency;
            return(<Card key={lawn.id}><div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:36,height:36,borderRadius:10,background:due?"#EF444420":G+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:15,fontWeight:800,color:due?"#EF4444":G}}>{i+1}</span></div><div style={{flex:1}}><p style={{margin:"0 0 2px",fontWeight:700,fontSize:14,color:"#1A1E16"}}>{lawn.name}</p><p style={{margin:0,fontSize:12,color:"#8A9280"}}>{lawn.address||"No address"} · ~{dist} mi</p></div>{due&&<span style={{fontSize:11,fontWeight:700,color:"#EF4444",background:"#EF444415",borderRadius:20,padding:"3px 10px"}}>Due</span>}</div></Card>);
          })}
          {!route.length&&<p style={{textAlign:"center",color:"#8A9280",fontSize:14,padding:"32px 0"}}>Add lawns with addresses to optimize your route.</p>}
        </div>
      )}

      {sub==="crew"&&(
        <div>
          <button onClick={()=>setShowAddCrew(v=>!v)} style={{width:"100%",padding:14,background:G,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:14}}>+ Add Crew Member</button>
          {showAddCrew&&<Card mb={14} p="16px">
            <Label>Name</Label><Inp value={cf.name} onChange={e=>setCf(f=>({...f,name:e.target.value}))} placeholder="e.g. Marcus T."/>
            <Label>Phone</Label><Inp type="tel" value={cf.phone} onChange={e=>setCf(f=>({...f,phone:e.target.value}))} placeholder="531-555-0000"/>
            <Label>Role</Label><div style={{display:"flex",gap:8,marginBottom:14}}>{["Lead","Crew","Part-Time"].map(r=><Chip key={r} active={cf.role===r} onClick={()=>setCf(f=>({...f,role:r}))} sm>{r}</Chip>)}</div>
            <button onClick={addCrew} style={{width:"100%",padding:12,background:cf.name.trim()?G:"#B0C8AE",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>Add Member</button>
          </Card>}
          <SLabel>Team ({crew.length})</SLabel>
          {crew.map(c=>{
            const assigned=lawns.filter(l=>l.crewId===c.id);
            return(<Card key={c.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><p style={{margin:"0 0 2px",fontWeight:800,fontSize:15,color:"#1A1E16"}}>{c.name}</p><p style={{margin:"0 0 6px",fontSize:12,color:"#8A9280"}}>{c.role}{c.phone?` · ${c.phone}`:""}</p><p style={{margin:0,fontSize:12,color:G,fontWeight:600}}>{assigned.length} lawn{assigned.length!==1?"s":""} assigned{assigned.length>0?`: ${assigned.map(l=>l.name).join(", ")}`:""}</p></div><button onClick={()=>onUpdateCrew(crew.filter(x=>x.id!==c.id))} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#EF4444",padding:"2px 4px"}}>🗑</button></div></Card>);
          })}
          {!crew.length&&<div style={{textAlign:"center",padding:"32px 24px",color:"#8A9280"}}><p style={{fontSize:40,margin:"0 0 10px"}}>👥</p><p style={{fontSize:15,fontWeight:700,color:"#1A1E16",margin:"0 0 6px"}}>No crew members yet</p><p style={{fontSize:13,margin:0,lineHeight:1.55}}>Add your team members here and assign them to specific lawns from the lawn's edit screen.</p></div>}
        </div>
      )}

      {sub==="invoices"&&(
        <div>
          <SLabel>Generate Invoices</SLabel>
          {lawns.filter(l=>l.tag!=="Personal").map(lawn=>{
            const p=Number(lawn.pricePerMow)||0; const mo=p*(30/lawn.frequency);
            return(<Card key={lawn.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:p?0:8}}><div><p style={{margin:"0 0 2px",fontWeight:700,fontSize:14,color:"#1A1E16"}}>{lawn.name}</p><p style={{margin:0,fontSize:12,color:"#8A9280"}}>{lawn.contactName||"No contact"}{p>0?` · ${fmtMoney(mo)}/mo`:""}</p></div><div style={{display:"flex",gap:8}}><button onClick={()=>onShare(lawn)} style={{padding:"7px 12px",background:"#F4F6F2",border:"2px solid #DDE2D8",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",color:"#5A6B50"}}>🔗 Share</button><button onClick={()=>onInvoice(lawn)} style={{padding:"7px 12px",background:G,color:"#fff",border:"none",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer"}}>🧾 Invoice</button></div></div>{!p&&<p style={{margin:0,fontSize:11,color:"#EF4444"}}>⚠ No price set — edit lawn to add pricing.</p>}</Card>);
          })}
          {!lawns.filter(l=>l.tag!=="Personal").length&&<p style={{textAlign:"center",color:"#8A9280",fontSize:14,padding:"32px 0"}}>Add residential or commercial lawns to generate invoices.</p>}
        </div>
      )}

      {sub==="earnings"&&(
        <div>
          <div style={{display:"flex",background:"#fff",borderRadius:14,padding:4,marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>{PERIODS.map(p=><button key={p.id} onClick={()=>setPeriod(p.id)} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:period===p.id?G:"transparent",color:period===p.id?"#fff":"#8A9280",transition:"all 0.2s"}}>{p.label}</button>)}</div>
          <div style={{background:`linear-gradient(135deg,${DARK},${G})`,borderRadius:18,padding:"22px 20px",marginBottom:18,color:"#fff",textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:12,opacity:0.65,fontWeight:700,letterSpacing:"0.08em"}}>ESTIMATED {period.toUpperCase()}LY EARNINGS</p>
            <p style={{margin:"0 0 4px",fontSize:50,fontWeight:200,lineHeight:1}}>{fmtMoney(total)}</p>
            <p style={{margin:0,fontSize:13,opacity:0.65}}>{priced.length} paid lawn{priced.length!==1?"s":""}</p>
          </div>
          {!priced.length?<div style={{textAlign:"center",padding:40,color:"#8A9280"}}><p style={{fontSize:40,margin:"0 0 10px"}}>💵</p><p style={{fontSize:15,fontWeight:700,color:"#1A1E16",margin:"0 0 4px"}}>No pricing set</p><p style={{fontSize:13,margin:0}}>Edit your lawns and add a price per mow.</p></div>
            :priced.map(lawn=>{const val=calc(lawn);return(<Card key={lawn.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div><p style={{margin:"0 0 2px",fontWeight:700,fontSize:15,color:"#1A1E16"}}>{lawn.name}</p><p style={{margin:0,fontSize:12,color:"#8A9280"}}>${lawn.pricePerMow}/mow · {FREQ_OPTIONS.find(f=>f.days===lawn.frequency)?.label}</p></div><p style={{margin:0,fontSize:22,fontWeight:800,color:G}}>{fmtMoney(val)}</p></div><div style={{background:"#F0F0EC",borderRadius:99,height:8,overflow:"hidden"}}><div style={{width:`${(val/maxVal)*100}%`,height:"100%",background:"#4CAF50",borderRadius:99,transition:"width 0.4s"}}/></div></Card>);})}
        </div>
      )}
    </div>
  );
}

/* ─── Equipment Tab ─── */
function EquipmentTab({equipment,onUpdate}){
  const [showAdd,setShowAdd]=useState(false);
  const [ef,setEf]=useState({name:"",category:"Mower",tasks:[]});
  const [taskName,setTaskName]=useState(""); const [taskDays,setTaskDays]=useState(90);
  const setE=(k,v)=>setEf(f=>({...f,[k]:v}));
  const addTask=()=>{if(!taskName.trim())return;setEf(f=>({...f,tasks:[...f.tasks,{name:taskName,lastDone:todayStr(),intervalDays:taskDays}]}));setTaskName("");setTaskDays(90);};
  const save=()=>{if(!ef.name.trim())return;onUpdate([...equipment,{id:nextEquipId++,...ef}]);setEf({name:"",category:"Mower",tasks:[]});setShowAdd(false);};
  const logTask=(eid,ti)=>onUpdate(equipment.map(e=>e.id===eid?{...e,tasks:e.tasks.map((t,i)=>i===ti?{...t,lastDone:todayStr()}:t)}:e));
  return(
    <div style={{padding:"0 16px 16px"}}>
      <button onClick={()=>setShowAdd(v=>!v)} style={{width:"100%",padding:14,background:G,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:16}}>+ Add Equipment</button>
      {showAdd&&<Card mb={16} p="16px">
        <Label>Equipment Name</Label><Inp value={ef.name} onChange={e=>setE("name",e.target.value)} placeholder='e.g. Husqvarna 21"'/>
        <Label>Category</Label><select value={ef.category} onChange={e=>setE("category",e.target.value)} style={iSty}>{EQUIP_CATS.map(c=><option key={c}>{c}</option>)}</select>
        <Divider>Maintenance Tasks</Divider>
        {ef.tasks.map((t,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#F6F8F5",borderRadius:8,marginBottom:6,fontSize:13}}><span style={{color:"#1A1E16"}}>{t.name}</span><span style={{color:"#8A9280"}}>Every {t.intervalDays}d</span></div>)}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <select value={taskName} onChange={e=>setTaskName(e.target.value)} style={{...iSty,marginBottom:0,flex:2}}><option value="">Pick task…</option>{(MAINT_TASKS[ef.category]||[]).map(t=><option key={t}>{t}</option>)}</select>
          <select value={taskDays} onChange={e=>setTaskDays(Number(e.target.value))} style={{...iSty,marginBottom:0,flex:1}}>{[30,60,90,120,180,365].map(d=><option key={d} value={d}>{d}d</option>)}</select>
        </div>
        <button onClick={addTask} style={{width:"100%",padding:10,background:"#F4F6F2",border:"2px solid #DDE2D8",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",color:"#5A6B50",marginBottom:12}}>+ Add Task</button>
        <button onClick={save} style={{width:"100%",padding:13,background:ef.name.trim()?G:"#B0C8AE",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"}}>Save Equipment</button>
      </Card>}
      <SLabel>Equipment ({equipment.length})</SLabel>
      {equipment.map(equip=>{
        const overdue=equip.tasks.filter(t=>daysSince(t.lastDone)>t.intervalDays).length;
        return(
          <div key={equip.id} style={{background:"#fff",borderRadius:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"hidden"}}>
            <div style={{padding:"14px 16px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div><p style={{margin:"0 0 2px",fontWeight:800,fontSize:16,color:"#1A1E16"}}>{equip.name}</p><p style={{margin:0,fontSize:12,color:"#8A9280"}}>{equip.category}</p></div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {overdue>0&&<span style={{fontSize:11,fontWeight:700,color:"#EF4444",background:"#EF444415",borderRadius:20,padding:"3px 10px"}}>{overdue} overdue</span>}
                  <button onClick={()=>onUpdate(equipment.filter(e=>e.id!==equip.id))} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#EF4444",padding:"2px 4px"}}>🗑</button>
                </div>
              </div>
              {equip.tasks.map((task,ti)=>{
                const ds=daysSince(task.lastDone); const pct=Math.min(ds/task.intervalDays,1);
                const due=pct>=1; const col=due?"#EF4444":pct>0.75?"#F59E0B":"#4CAF50"; const left=task.intervalDays-ds;
                return(
                  <div key={ti} style={{padding:"10px 0",borderTop:"1px solid #F4F4F0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div><p style={{margin:"0 0 2px",fontSize:13,fontWeight:700,color:"#1A1E16"}}>{task.name}</p><p style={{margin:0,fontSize:11,color:"#8A9280"}}>Last: {fmtDate(task.lastDone)} · Every {task.intervalDays}d</p></div>
                      <span style={{fontSize:11,fontWeight:700,color:col,background:col+"20",borderRadius:20,padding:"3px 8px"}}>{due?`${ds-task.intervalDays}d overdue`:left<=7?`${left}d left`:"✓ Good"}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{flex:1,background:"#F0F0EC",borderRadius:99,height:5,overflow:"hidden"}}><div style={{width:`${Math.min(pct*100,100)}%`,height:"100%",background:col,borderRadius:99}}/></div>
                      <button onClick={()=>logTask(equip.id,ti)} style={{padding:"5px 12px",background:G,color:"#fff",border:"none",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Done</button>
                    </div>
                  </div>
                );
              })}
              {!equip.tasks.length&&<p style={{fontSize:12,color:"#8A9280",margin:"4px 0 0"}}>No maintenance tasks added.</p>}
            </div>
          </div>
        );
      })}
      {!equipment.length&&<div style={{textAlign:"center",padding:"40px 24px",color:"#8A9280"}}><p style={{fontSize:52,margin:"0 0 14px"}}>🔧</p><p style={{fontSize:17,fontWeight:800,color:"#1A1E16",margin:"0 0 6px"}}>No equipment yet</p><p style={{fontSize:13,margin:0,lineHeight:1.55}}>Add your mowers, trimmers, and blowers to track maintenance intervals and get alerted before anything breaks down.</p></div>}
    </div>
  );
}

/* ─── Schedule Tab ─── */
function Schedule({lawns}){
  const WDAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const days14=Array.from({length:14},(_,i)=>{const d=new Date(Date.now()+i*86400000);const mows=lawns.filter(l=>{const due=new Date(new Date(l.lastMowed+"T00:00:00").getTime()+l.frequency*86400000);return due.toDateString()===d.toDateString();});return{date:d,mows,i};});
  return(
    <div style={{padding:"0 16px 16px"}}>
      <SLabel>Next 14 Days</SLabel>
      {days14.map(({date,mows,i})=>{
        const hasMow=mows.length>0; const wDay=WEATHER.forecast[Math.min(i,WEATHER.forecast.length-1)];
        return(
          <div key={i} style={{display:"flex",alignItems:"stretch",marginBottom:8,opacity:hasMow?1:0.32}}>
            <div style={{width:44,flexShrink:0,textAlign:"center",paddingTop:6}}>
              <p style={{margin:0,fontSize:11,color:"#8A9280",fontWeight:600}}>{WDAYS[date.getDay()]}</p>
              <p style={{margin:"2px 0 0",fontSize:20,fontWeight:i===0?800:500,color:i===0?G:"#1A1E16"}}>{date.getDate()}</p>
            </div>
            <div style={{width:3,background:hasMow?G:"#E0E0D8",margin:"6px 12px 6px",borderRadius:2,minHeight:36}}/>
            <div style={{flex:1,paddingTop:4}}>
              {hasMow?mows.map(lawn=>(
                <div key={lawn.id} style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:6,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><p style={{margin:0,fontWeight:700,fontSize:14,color:"#1A1E16"}}>{lawn.name}</p><p style={{margin:"2px 0 0",fontSize:11,color:"#8A9280"}}>{lawn.grassType}{Number(lawn.pricePerMow)>0?` · $${lawn.pricePerMow}`:""}</p></div>
                    <div style={{textAlign:"right"}}><span style={{fontSize:18}}>{wDay?.icon||"☀️"}</span><p style={{margin:"2px 0 0",fontSize:11,fontWeight:700,color:scoreColor(wDay?.mow||80)}}>Score {wDay?.mow||80}</p></div>
                  </div>
                </div>
              )):<p style={{margin:"8px 0",fontSize:12,color:"#C0C0B8"}}>No mows scheduled</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Weather Tab ─── */
function WeatherTab(){
  const w=WEATHER.today;
  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{background:`linear-gradient(135deg,${DARK},#2F6C24)`,borderRadius:18,padding:20,marginBottom:18,color:"#fff"}}>
        <p style={{margin:"0 0 4px",fontSize:11,opacity:0.6,fontWeight:700,letterSpacing:"0.08em"}}>TODAY · {WEATHER.location}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p style={{margin:"4px 0 4px",fontSize:50,fontWeight:200,lineHeight:1}}>{w.temp}°<span style={{fontSize:22}}>F</span></p><p style={{margin:"0 0 10px",fontSize:15}}>{w.icon} {w.condition}</p><div style={{fontSize:13,opacity:0.85,display:"flex",flexDirection:"column",gap:4}}><span>💧 {w.humidity}% humidity</span><span>💨 {w.windSpeed} mph wind</span><span>🌧 {w.rainChance}% rain chance</span></div></div>
          <ScoreRing score={WEATHER.forecast[0].mow} size={106}/>
        </div>
      </div>
      <Card mb={18} p="16px">
        <SLabel>Mowing Tips</SLabel>
        {[["🕖","Best window today: 7:30–10:00 AM"],["💦","Don't mow within 24 hrs of heavy rain — wet grass tears."],["🌡️","Mow below 85°F to reduce heat stress on turf."],["✂️","Never remove more than 1/3 of blade height at once."],["🌅","Morning mows let blades heal before nighttime moisture."]].map(([icon,tip])=>(
          <div key={tip} style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:13,color:"#1A1E16",marginBottom:10}}><span style={{flexShrink:0}}>{icon}</span><span>{tip}</span></div>
        ))}
      </Card>
      <SLabel>7-Day Forecast</SLabel>
      {WEATHER.forecast.map((day,i)=>{
        const col=scoreColor(day.mow); const label=day.mow>=75?"✓ Good":day.mow>=45?"~ Fair":"✗ Skip";
        return(
          <div key={day.day} style={{background:"#fff",borderRadius:12,padding:"12px 16px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center"}}><span style={{width:46,fontSize:13,fontWeight:i===0?800:500,color:"#1A1E16"}}>{day.day}</span><span style={{width:28,fontSize:18}}>{day.icon}</span><span style={{flex:1,fontSize:13,color:"#6B7261"}}>{day.condition}</span><span style={{fontSize:12,color:"#8A9280",marginRight:10}}>{day.high}°/{day.low}°</span><span style={{fontSize:12,fontWeight:700,color:col,background:col+"20",borderRadius:20,padding:"3px 10px"}}>{label}</span></div>
            {day.bestWindow?<p style={{margin:"5px 0 0",fontSize:11,color:"#6B7261",paddingLeft:74}}>🕖 {day.bestWindow} — {day.advisory}</p>:<p style={{margin:"5px 0 0",fontSize:11,color:"#EF4444",paddingLeft:74}}>⛔ {day.advisory}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Onboarding ─── */
const ONBOARDING=[
  {icon:"🌿",title:"Welcome to GreenForge",body:"The all-in-one lawn management app built for homeowners and landscaping businesses.",color:"#1D2E1A"},
  {icon:"📅",title:"Track Every Lawn",body:"Add multiple lawns, set mow schedules, get weather-based advice, and log photos to confirm every mow.",color:"#2D5C20"},
  {icon:"💼",title:"Run Your Business",body:"Manage your crew, optimize routes, generate invoices, and track earnings — all in one place.",color:"#1A3A14"},
];
function OnboardingScreen({onDone}){
  const [slide,setSlide]=useState(0);
  const last=slide===ONBOARDING.length-1;
  const s=ONBOARDING[slide];
  return(
    <div style={{position:"fixed",inset:0,background:s.color,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"60px 32px 48px",zIndex:500,maxWidth:430,margin:"0 auto",transition:"background 0.4s"}}>
      <div style={{textAlign:"center",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:80,marginBottom:28,lineHeight:1}}>{s.icon}</div>
        <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",letterSpacing:"0.12em",textTransform:"uppercase"}}>GREENFORGE</p>
        <h1 style={{margin:"0 0 18px",fontSize:28,fontWeight:800,color:"#fff",lineHeight:1.2,textAlign:"center"}}>{s.title}</h1>
        <p style={{margin:0,fontSize:16,color:"rgba(255,255,255,0.75)",lineHeight:1.65,textAlign:"center"}}>{s.body}</p>
      </div>
      {/* Dots */}
      <div style={{display:"flex",gap:8,marginBottom:32}}>
        {ONBOARDING.map((_,i)=><div key={i} style={{width:i===slide?22:7,height:7,borderRadius:99,background:i===slide?"#fff":"rgba(255,255,255,0.3)",transition:"all 0.3s"}}/>)}
      </div>
      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>last?onDone():setSlide(s=>s+1)}
          style={{width:"100%",padding:16,background:"#fff",color:s.color,border:"none",borderRadius:14,fontSize:17,fontWeight:800,cursor:"pointer"}}>
          {last?"Get Started →":"Next"}
        </button>
        {!last&&<button onClick={onDone} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:14,cursor:"pointer",padding:8}}>Skip</button>}
      </div>
    </div>
  );
}

/* ─── Toast ─── */
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2200);return()=>clearTimeout(t);},[]);
  return(
    <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"#1D2E1A",color:"#fff",padding:"12px 22px",borderRadius:99,fontSize:14,fontWeight:700,zIndex:500,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:18}}>✅</span>{msg}
    </div>
  );
}

/* ─── Initial Data ─── */
const INITIAL_LAWNS=[];
const INITIAL_CREW=[];
const INITIAL_EQUIPMENT=[];

const TABS=[{id:"dashboard",label:"Home",icon:"⬡"},{id:"lawns",label:"Lawns",icon:"🌿"},{id:"schedule",label:"Schedule",icon:"📅"},{id:"business",label:"Business",icon:"💼"},{id:"equipment",label:"Equip",icon:"🔧"}];

/* ─── App Root ─── */
export default function App(){
  const [tab,setTab]=useState("dashboard");
  const [lawns,setLawns]=useState(INITIAL_LAWNS);
  const [crew,setCrew]=useState(INITIAL_CREW);
  const [equipment,setEquipment]=useState(INITIAL_EQUIPMENT);
  const [showAdd,setShowAdd]=useState(false);
  const [editLawn,setEditLawn]=useState(null);
  const [mowTarget,setMowTarget]=useState(null);
  const [showChat,setShowChat]=useState(false);
  const [journalLawn,setJournalLawn]=useState(null);
  const [baLawn,setBaLawn]=useState(null);
  const [invoiceLawn,setInvoiceLawn]=useState(null);
  const [shareLawn,setShareLawn]=useState(null);
  const [homeBase,setHomeBase]=useState("");
  const [onboarded,setOnboarded]=useState(false);
  const [toast,setToast]=useState(null);

  const TAB_IDS=TABS.map(t=>t.id);
  const touchStartX=useRef(null);
  const handleTouchStart=e=>{ touchStartX.current=e.touches[0].clientX; };
  const handleTouchEnd=e=>{
    if(touchStartX.current===null)return;
    const diff=touchStartX.current-e.changedTouches[0].clientX;
    if(Math.abs(diff)<60)return;
    const idx=TAB_IDS.indexOf(tab);
    if(diff>0&&idx<TAB_IDS.length-1)setTab(TAB_IDS[idx+1]);
    if(diff<0&&idx>0)setTab(TAB_IDS[idx-1]);
    touchStartX.current=null;
  };

  const mowTargetLawn=lawns.find(l=>l.id===mowTarget);
  const handleMow=(id,photo)=>{
    setLawns(ls=>ls.map(l=>{if(l.id!==id)return l;const entry={date:todayStr(),photo:photo||null};return{...l,lastMowed:todayStr(),lastMowedPhoto:photo||l.lastMowedPhoto,mowHistory:[entry,...(l.mowHistory||[])]};  }));
    const name=lawns.find(l=>l.id===id)?.name||"Lawn";
    setToast(`${name} marked as mowed!`);
    setMowTarget(null);
  };
  const handleAdd=f=>{setLawns(ls=>[...ls,{...f,id:nextLawnId++,size:Number(f.size)||0,pricePerMow:Number(f.pricePerMow)||0,lastMowedPhoto:null,mowHistory:[],journal:[]}]);setShowAdd(false);};
  const handleEdit=f=>{setLawns(ls=>ls.map(l=>l.id===editLawn.id?{...l,...f,size:Number(f.size)||l.size,pricePerMow:Number(f.pricePerMow)||0}:l));setEditLawn(null);};
  const handleDelete=id=>setLawns(ls=>ls.filter(l=>l.id!==id));
  const handleToggleMute=id=>setLawns(ls=>ls.map(l=>l.id===id?{...l,muted:!l.muted}:l));
  const handleJournal=(lawnId,entries)=>setLawns(ls=>ls.map(l=>l.id===lawnId?{...l,journal:entries}:l));

  const overdueCount=lawns.filter(l=>daysSince(l.lastMowed)>=l.frequency).length;
  const overdueEquip=equipment.flatMap(e=>e.tasks.filter(t=>daysSince(t.lastDone)>t.intervalDays)).length;

  const nowLabel=new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});

  if(!onboarded)return(
    <div style={{maxWidth:430,margin:"0 auto",height:"100vh",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <OnboardingScreen onDone={()=>setOnboarded(true)}/>
    </div>
  );

  return(
    <div style={{maxWidth:430,margin:"0 auto",height:"100vh",display:"flex",flexDirection:"column",background:"#EEF0EA",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{display:none;}
        input,select,textarea{font-family:'Inter',system-ui,sans-serif;}
        button:focus{outline:none;}
        @keyframes dot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>
      {/* Header */}
      <div style={{background:DARK,color:"#fff",padding:"12px 16px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div>
          <p style={{margin:"0 0 1px",fontSize:10,opacity:0.45,fontWeight:800,letterSpacing:"0.12em"}}>GREENFORGE</p>
          <h1 style={{margin:"0 0 1px",fontSize:19,fontWeight:800}}>{{dashboard:"Dashboard",lawns:"My Lawns",schedule:"Schedule",business:"Business",equipment:"Equipment"}[tab]}</h1>
          <p style={{margin:0,fontSize:11,opacity:0.45,fontWeight:600}}>{nowLabel}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          {overdueCount>0&&<div style={{background:"#E09820",borderRadius:99,padding:"5px 11px",fontSize:12,fontWeight:800}}>{overdueCount} due</div>}
          {overdueEquip>0&&<div style={{background:"#EF4444",borderRadius:99,padding:"5px 10px",fontSize:12,fontWeight:800}}>🔧{overdueEquip}</div>}
          <button onClick={()=>setShowChat(true)} style={{background:"rgba(255,255,255,0.13)",border:"none",borderRadius:20,padding:"7px 12px",cursor:"pointer",color:"#fff",fontSize:13,fontWeight:700}}>💬 AI</button>
        </div>
      </div>
      {/* Content */}
      <div style={{flex:1,overflowY:"auto",paddingTop:16}} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {tab==="dashboard"&&<Dashboard    lawns={lawns} crew={crew} onMow={setMowTarget} onToggleMute={handleToggleMute}/>}
        {tab==="lawns"    &&<LawnList     lawns={lawns} crew={crew} onMow={setMowTarget} onAdd={()=>setShowAdd(true)} onEdit={setEditLawn} onDelete={handleDelete} onToggleMute={handleToggleMute} onJournal={setJournalLawn} onBeforeAfter={setBaLawn} onInvoice={setInvoiceLawn} onShare={setShareLawn}/>}
        {tab==="schedule" &&<Schedule     lawns={lawns}/>}
        {tab==="business" &&<BusinessTab  lawns={lawns} crew={crew} onUpdateCrew={setCrew} onInvoice={setInvoiceLawn} onShare={setShareLawn} homeBase={homeBase} onSetHomeBase={setHomeBase}/>}
        {tab==="equipment"&&<EquipmentTab equipment={equipment} onUpdate={setEquipment}/>}
      </div>
      {/* Tab position dots */}
      <div style={{background:DARK,display:"flex",justifyContent:"center",gap:5,paddingTop:6,flexShrink:0}}>
        {TABS.map(t=><div key={t.id} style={{width:t.id===tab?18:5,height:4,borderRadius:99,background:t.id===tab?"#E09820":"rgba(255,255,255,0.18)",transition:"all 0.25s"}}/>)}
      </div>
      {/* Bottom Nav */}
      <div style={{background:DARK,display:"flex",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.06)",paddingBottom:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"8px 0 12px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,opacity:tab===t.id?1:0.35,position:"relative",transition:"opacity 0.2s"}}>
            <span style={{fontSize:18}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:700,color:"#fff",letterSpacing:"0.03em"}}>{t.label}</span>
            {t.id==="equipment"&&overdueEquip>0&&<div style={{position:"absolute",top:6,right:"18%",width:8,height:8,borderRadius:"50%",background:"#EF4444",border:"1.5px solid #1D2E1A"}}/>}
          </button>
        ))}
      </div>
      {/* Overlays */}
      {showAdd      &&<LawnModal       onSave={handleAdd}   onClose={()=>setShowAdd(false)} crew={crew}/>}
      {editLawn     &&<LawnModal       onSave={handleEdit}  onClose={()=>setEditLawn(null)} crew={crew} initial={editLawn}/>}
      {mowTarget    &&<MowPhotoModal   lawnName={mowTargetLawn?.name||""} onConfirm={photo=>handleMow(mowTarget,photo)} onClose={()=>setMowTarget(null)}/>}
      {showChat     &&<ChatModal       lawns={lawns} onClose={()=>setShowChat(false)}/>}
      {journalLawn  &&<JournalModal    lawn={journalLawn} onSave={entries=>handleJournal(journalLawn.id,entries)} onClose={()=>setJournalLawn(null)}/>}
      {baLawn       &&<BeforeAfterModal lawn={baLawn} onClose={()=>setBaLawn(null)}/>}
      {invoiceLawn  &&<InvoiceModal    lawn={invoiceLawn} onClose={()=>setInvoiceLawn(null)}/>}
      {shareLawn    &&<ShareModal      lawn={shareLawn} onClose={()=>setShareLawn(null)}/>}
      {toast        &&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}

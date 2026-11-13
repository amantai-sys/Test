# Builds voice-over: per-phrase Piper TTS -> vo.wav + timeline.json (phrase + word timings via whisper alignment)
import json, subprocess, wave, sys, re, difflib, os
import numpy as np, scipy.signal as ss
VOICE = sys.argv[1]; OUT = sys.argv[2]
SR = 48000
# (scene id, display text, spoken text, gap after in s)
P = [
 ("open","He spent three weeks sanding the corners off 36 airplane windows.","He spent three weeks sanding the corners off thirty-six airplane windows.",0.25),
 ("year","You see, it's 1952, and the jet age has just begun.","You see, it's nineteen fifty-two, and the jet age has just begun.",0.12),
 ("square","Every designer wants big square windows. Sleek. Modern. Like a fancy hotel.",None,0.2),
 ("round","So when he rolls out tiny round portholes, his rival nearly chokes on his tea.",None,0.15),
 ("quote","\"Lovely. Are we building a jet, or a washing machine?\"","Lovely. Are we building a jet, or a washing machine?",0.3),
 ("weird","But it gets weirder.",None,0.1),
 ("paper","That night, he cuts holes in paper. Square ones. Round ones. And tears them, again and again.",None,0.25),
 ("rollout","Meanwhile, the rival's jet rolls out with gorgeous square windows, and the whole airfield claps.",None,0.25),
 ("tank","Then the testers lower both jets into a giant tank of water.",None,0.15),
 ("pump","They pump the cabins full of air, then let it out. Up and down, like a flight. Three thousand times.",None,0.2),
 ("pssh","",None,1.9),
 ("crack","Then something tiny appears. A hairline crack. Right at the corner of a window.",None,0.3),
 ("what","Wait, what?",None,0.35),
 ("flow","You see, every time a jet climbs, the air inside pushes on the walls, and that push has to flow around each window.",None,0.15),
 ("tear","Ever tried to tear paper with a round hole? It holds. Cut a square hole, and it rips right from the corner.",None,0.25),
 ("burst","The crack races along the cabin, the metal bursts, and the tank blasts the rival with a wall of water.",None,0.3),
 ("round2","Soon after, airliners switched to round windows.",None,0.2),
 ("seat","And the rival? He still flies, but he always books a seat as far as possible from the",None,0.0),
]
tmp = OUT+"/vo_parts"; os.makedirs(tmp, exist_ok=True)
def tts(text, f, ls):
    subprocess.run([sys.executable,"-m","piper","-m",VOICE,"-f",f,"--length-scale",str(ls),"--sentence-silence","0.12"],input=text.encode(),check=True,capture_output=True)
    w=wave.open(f); sr=w.getframerate(); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
    a=ss.resample_poly(a,SR,sr)
    # trim silence
    env=np.abs(a)>0.01; idx=np.where(env)[0]
    return a[max(0,idx[0]-200):idx[-1]+1200]
start = 0.35; chunks=[]; phrases=[]
t=start
for i,(sc,disp,spk,gap) in enumerate(P):
    ls = 0.71
    gap = gap*0.6 if sc!='pssh' else gap
    if not disp:
        phrases.append(dict(i=i,scene=sc,text='',start=round(t,3),end=round(t,3))); t+=gap; continue
    pass
    if sc in("what",): ls=0.95
    a = tts(spk or disp, f"{tmp}/{i}.wav", ls)
    if sc=="fire":  # hard cut mid-word: cut before last word's tail
        pass
    phrases.append(dict(i=i,scene=sc,text=disp,start=round(t,3),end=round(t+len(a)/SR,3)))
    chunks.append((t,a)); t += len(a)/SR + gap
total = t
y=np.zeros(int((total+0.1)*SR),np.float32)
for t0,a in chunks:
    s=int(t0*SR); y[s:s+len(a)]+=a
# whisper word timings
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
y16=ss.resample_poly(y,16000,SR).astype(np.float32)
segs,_=m.transcribe(y16,word_timestamps=True,initial_prompt=" ".join((p[2] or p[1]) for p in P))
ww=[(x.start,x.end,x.word.strip()) for s in segs for x in s.words]
norm=lambda s: re.sub(r"[^a-z0-9]","",s.lower())
words=[]
for p in phrases:
    toks=p["text"].split() if p["text"] else []
    # spoken tokens count may differ (numbers); assign by alignment over all, fallback proportional
    for k,tok in enumerate(toks): words.append(dict(p=p["i"],w=tok))
# proportional fallback per phrase, refined by whisper words falling inside phrase window
for p in phrases:
    toks=[w for w in words if w["p"]==p["i"]]
    inside=[x for x in ww if x[0]>=p["start"]-0.15 and x[0]<p["end"]+0.05]
    if not toks: continue
    L=sum(len(w["w"])+2 for w in toks); c=0; dur=p["end"]-p["start"]
    for w in toks:
        w["s"]=round(p["start"]+dur*c/L,3); c+=len(w["w"])+2; w["e"]=round(p["start"]+dur*c/L,3)
    # match by normalized text
    sm=difflib.SequenceMatcher(None,[norm(w["w"]) for w in toks],[norm(x[2]) for x in inside])
    for blk in sm.get_matching_blocks():
        for j in range(blk.size):
            toks[blk.a+j]["s"]=round(inside[blk.b+j][0],3); toks[blk.a+j]["e"]=round(inside[blk.b+j][1],3)
    # enforce monotonic
    for a,b in zip(toks,toks[1:]):
        if b["s"]<a["s"]: b["s"]=a["e"]
import scipy.io.wavfile as wf
wf.write(OUT+"/vo.wav",SR,(np.clip(y,-1,1)*32767).astype(np.int16))
json.dump(dict(total=round(total,3),phrases=phrases,words=words,heard=ww),open(OUT+"/timeline.json","w"),indent=1)
print("total",total); print(" ".join(x[2] for x in ww))

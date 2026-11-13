# Builds voice-over: per-phrase Piper TTS -> vo.wav + timeline.json (phrase + word timings via whisper alignment)
import json, subprocess, wave, sys, re, difflib, os
import numpy as np, scipy.signal as ss
VOICE = sys.argv[1]; OUT = sys.argv[2]
SR = 48000
# (scene id, display text, spoken text, gap after in s)
P = [
 ("open","He ordered 38 soldiers to cross a bridge like they'd just left a tavern.","He ordered thirty-eight soldiers to cross a bridge like they'd just left a tavern.",0.25),
 ("parade","You see, it's 1831,","You see, it's eighteen thirty-one,",0.08),
 ("parade","and his regiment has spent months learning to march in perfect step.",None,0.12),
 ("boots","Left, right, left.",None,0.1),
 ("boots","Every boot hitting the ground at the exact same moment.",None,0.1),
 ("general","It's the pride of the army.",None,0.25),
 ("break","So when the captain yells \"Break step!\"","So when the captain yells, Break step!",0.05),
 ("bridge","right in front of a brand-new chain bridge,",None,0.05),
 ("ducks","his men stumble across like a herd of confused ducks.",None,0.25),
 ("rival","On the far bank, a rival captain is laughing.",None,0.12),
 ("rival","\"Lovely. Should we fetch them some walking sticks?\"","Lovely. Should we fetch them some walking sticks?",0.3),
 ("weird","But it gets weirder.",None,0.1),
 ("tiptoe","The captain makes his men cross one at a time. Ten feet apart. On tiptoe.",None,0.25),
 ("march","Meanwhile, the rival lines up 74 men,","Meanwhile, the rival lines up seventy-four men,",0.05),
 ("march","shoulders back, chins up,",None,0.05),
 ("march","and marches them onto the bridge in flawless rhythm.",None,0.2),
 ("thump","",None,1.9),
 ("hum","Then the bridge starts to hum.",None,0.12),
 ("hum","A tiny wobble. Then a bigger one.",None,0.12),
 ("xray","The chains swing closer and closer to the beat of the boots.",None,0.3),
 ("what","Wait, what?",None,0.35),
 ("string","You see, every bridge has its own natural bounce, like a guitar string.",None,0.15),
 ("swing","Ever pushed a kid on a swing?",None,0.1),
 ("swing","Little pushes, at just the right moment, and they fly higher and higher.",None,0.15),
 ("pushes","74 soldiers stomping in sync are 74 perfectly timed pushes.","Seventy four soldiers stomping in sync are seventy four perfectly timed pushes.",0.3),
 ("snap","A bolt snaps. The deck tilts.",None,0.1),
 ("river","And 74 very proud soldiers slide straight into the river.","And seventy-four very proud soldiers slide straight into the river.",0.15),
 ("river","Still in step.",None,0.35),
 ("rules","Soon after, the army changed the rules. Every soldier breaks step on a bridge.",None,0.15),
 ("fire","And the rival captain? He spent a week drying his boots, his uniform and his",None,0.0),
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
    gap = gap*0.6 if sc!='thump' else gap
    if not disp:
        phrases.append(dict(i=i,scene=sc,text='',start=round(t,3),end=round(t,3))); t+=gap; continue
    if sc=="thump": ls=1.0
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

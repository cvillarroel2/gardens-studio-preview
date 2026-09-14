#!/bin/sh
# Run every existing scripted brush gesture. Mouse is the original demo path;
# touch exercises TOUCH_GAIN/TOUCH_REACH/TOUCH_VGAIN. Coverage is diagnostic.
set -eu
export GARDENS_DEMO_POINTER="${1:-touch}"
case "$GARDENS_DEMO_POINTER" in mouse|touch) ;; *) exit 2 ;; esac
ego-browser nodejs <<'JS'
await useOrCreateTaskSpace('Gardens mobile movement');
await openOrReuseTab('http://127.0.0.1:8913/',{wait:true});
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:3,mobile:true});
const pointer=process.env.GARDENS_DEMO_POINTER || 'touch';
for(const type of ['slow-short','slow-long','medium-long','fast-flick','fast-long-outside','veryfast-diag-outside','whip-outside','vertical','cross-exit','multi']) {
 await gotoAndWait('http://127.0.0.1:8913/?demo=swipe&type='+type+'&pointer='+pointer);
 let report=null;
 for(let i=0;i<26;i++){await wait(1);report=await js('window.__gardens?.demo?.report');if(report)break;}
 if(!report)throw new Error('Demo timed out: '+type);
 cliLog({type,pointer:report.pointer,coverage:report.coverage,covered:report.covered,expected:report.expected,peakTilt:report.peakTilt});
}
JS

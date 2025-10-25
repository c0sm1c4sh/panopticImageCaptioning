# panoptic-utils: Scene-Graph + Baseline Fusion for Better Captions
import os
os.environ["CUDA_VISIBLE_DEVICES"] = ""
import re
import nltk
from nltk.corpus import wordnet
from typing import List, Dict
from PIL import Image
import torch
from transformers import pipeline, BlipProcessor, BlipForConditionalGeneration
import open_clip
nltk.download("wordnet")
nltk.download("omw-1.4")

# -----------------------------
# Canonical labels + stopwords
# -----------------------------
STOPWORDS = {"a","an","the","and","or","of","on","in","with","to","for","by","at"}

LABEL_CANON = {
    "person":"person","man":"person","woman":"person",
    "bicycle":"bicycle","bike":"bicycle","motorcycle":"motorcycle",
    "car":"car","bus":"bus","train":"train","truck":"truck",
    "traffic light":"traffic light","fire hydrant":"fire hydrant",
    "stop sign":"stop sign","parking meter":"parking meter",
    "bench":"bench","bird":"bird","cat":"cat","dog":"dog",
    "horse":"horse","sheep":"sheep","cow":"cow","elephant":"elephant",
    "bear":"bear","zebra":"zebra","giraffe":"giraffe",
    "backpack":"backpack","umbrella":"umbrella","handbag":"handbag",
    "tie":"tie","suitcase":"suitcase","frisbee":"frisbee","skis":"skis",
    "snowboard":"snowboard","sports ball":"ball","kite":"kite",
    "baseball bat":"baseball bat","baseball glove":"baseball glove",
    "skateboard":"skateboard","surfboard":"surfboard","tennis racket":"tennis racket",
    "bottle":"bottle","wine glass":"wine glass","cup":"cup","fork":"fork",
    "knife":"knife","spoon":"spoon","bowl":"bowl","banana":"banana",
    "apple":"apple","sandwich":"sandwich","orange":"orange","broccoli":"broccoli",
    "carrot":"carrot","hot dog":"hot dog","pizza":"pizza","donut":"donut",
    "cake":"cake","chair":"chair","couch":"sofa",
    "potted plant":"potted plant","bed":"bed","dining table":"table",
    "toilet":"toilet","tv":"tv","laptop":"laptop","mouse":"mouse",
    "remote":"remote","keyboard":"keyboard","cell phone":"phone",
    "microwave":"microwave","oven":"oven","toaster":"toaster","sink":"sink",
    "refrigerator":"fridge","book":"book","clock":"clock","vase":"vase",
    "scissors":"scissors","teddy bear":"teddy bear","hair drier":"hair dryer",
    "toothbrush":"toothbrush",
    "road":"road","sidewalk":"sidewalk","building":"building","wall":"wall",
    "fence":"fence","pole":"pole","sky":"sky","ground":"ground",
    "grass":"grass","river":"river","sea":"sea","water":"water",
    "mountain":"mountain","tree":"tree","snow":"snow","sand":"sand",
}

def canon_label(label: str) -> str:
    l = label.strip().lower()
    l = l.replace("-merged", "").replace("-other", "").replace("-stuff", "")
    l = l.replace("-", " ")
    return LABEL_CANON.get(l, l)

# -----------------------------
# Caption evaluation helpers
# -----------------------------
def tokenize(s: str):
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return [t for t in s.split() if t and t not in STOPWORDS]

def compute_recall(labels: List[str], caption: str) -> float:
    toks = set(tokenize(caption))
    return sum(1 for l in labels if l in toks) / max(1, len(labels))

def get_topk_panoptic_labels(panoptic_output, topk: int) -> List[str]:
    agg: Dict[str, float] = {}
    for seg in panoptic_output:
        label = canon_label(seg.get("label", ""))
        if not label:
            continue
        if "area" in seg:
            w = float(seg["area"]) or 0.0
        elif "score" in seg:
            w = float(seg["score"]) or 0.0
        else:
            w = 1.0
        agg[label] = agg.get(label, 0.0) + w
    labels = [l for l, _ in sorted(agg.items(), key=lambda x: x[1], reverse=True)]
    labels = [l for l in labels if l not in {"thing", "stuff"}]
    return labels[:topk]

def is_redundant(label: str, baseline_caption: str) -> bool:
    """
    Checks whether a panoptic label is already covered by the baseline caption.
    Uses string match + synonym check.
    """
    baseline_lower = baseline_caption.lower()
    label_lower = label.lower()

    # direct substring match
    if label_lower in baseline_lower:
        return True

    # handle plural/singular (person <-> people, man <-> men, etc.)
    synonyms = set()
    for syn in wordnet.synsets(label_lower):
        for lemma in syn.lemmas():
            synonyms.add(lemma.name().lower())

    for syn in synonyms:
        if syn in baseline_lower:
            return True

    return False


# -----------------------------
# Fusion: Baseline + Panoptic (Improved)
# -----------------------------
def fuse_caption(baseline_caption: str, labels: List[str]) -> str:
    baseline_lower = baseline_caption.lower()

    # filter out duplicates using semantic check
    filtered = [lbl for lbl in labels if not is_redundant(lbl, baseline_caption)]

    if not filtered:
        return baseline_caption

    # environment labels
    environment = {"sky", "dirt", "grass", "road", "water", "ground", "sand", "snow"}
    env_labels = [lbl for lbl in filtered if lbl in environment]
    obj_labels = [lbl for lbl in filtered if lbl not in environment]

    parts = [baseline_caption]

    if obj_labels:
        if len(obj_labels) == 1:
            parts.append(f"with {obj_labels[0]} nearby")
        else:
            parts.append(f"with {', '.join(obj_labels[:-1])} and {obj_labels[-1]} nearby")

    if env_labels:
        if len(env_labels) == 1:
            parts.append(f"under/around {env_labels[0]}")
        else:
            parts.append(f"under/around {', '.join(env_labels[:-1])} and {env_labels[-1]}")

    return ", ".join(parts)


# -----------------------------
# Main Models wrapper
# -----------------------------
class Models:
    def __init__(self, device: int = -1):
        self.captioner = pipeline(
            "image-to-text",
            model="Salesforce/blip-image-captioning-base",
            device=device,
            max_new_tokens=40,
        )
        self.panoptic = pipeline(
            task="image-segmentation",
            model="facebook/mask2former-swin-large-coco-panoptic",
            device=device,
        )
        self.clip_model, _, self.clip_preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="openai"
        )
        self.clip_model.eval()
        if torch.cuda.is_available() and device != -1:
            self.clip_model = self.clip_model.cuda()
        self.clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")

    def clip_score(self, image: Image.Image, text: str) -> float:
        with torch.no_grad():
            img = self.clip_preprocess(image).unsqueeze(0)
            if torch.cuda.is_available():
                img = img.cuda()
            txt = self.clip_tokenizer([text])
            if torch.cuda.is_available() and isinstance(txt, dict):
                txt = {k: v.cuda() for k, v in txt.items()}
            img_feat = self.clip_model.encode_image(img)
            txt_feat = self.clip_model.encode_text(txt)
            img_feat /= img_feat.norm(dim=-1, keepdim=True)
            txt_feat /= txt_feat.norm(dim=-1, keepdim=True)
            sim = (img_feat * txt_feat).sum(dim=-1)
            return float(sim.item())

# -----------------------------
# Inference
# -----------------------------
def run_inference(models: Models, image: Image.Image, topk: int = 8):
    cap = models.captioner(image)[0]["generated_text"].strip()
    pan = models.panoptic(image)
    labels = get_topk_panoptic_labels(pan, topk=topk)
    cap_fused = fuse_caption(cap, labels)

    r_base = compute_recall(labels, cap)
    r_fused = compute_recall(labels, cap_fused)
    cs_base = models.clip_score(image, cap)
    cs_fused = models.clip_score(image, cap_fused)

    return {
    "labels_topk": labels,
    "baseline_caption": cap,
    "panoptic_caption": cap_fused,       # renamed
    "recall_baseline": r_base,
    "recall_panoptic": r_fused,          # renamed
    "clipscore_baseline": cs_base,
    "clipscore_panoptic": cs_fused,      # renamed
}


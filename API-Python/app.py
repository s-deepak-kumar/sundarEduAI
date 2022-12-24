from flask import Flask, jsonify, request
from flask_cors import CORS
from typing import List
import cohere
import numpy as np
import torch
from nltk import tokenize
import uuid
import youtube_dl

app = Flask(__name__)
CORS(app)

torchfy = lambda x: torch.as_tensor(x, dtype=torch.float32)

# model_name: str = 'multilingual-2210-alpha'
model_name: str = 'multilingual-22-12'
#Co:here configuration; for getting API key & docs visit https://dashboard.cohere.ai/
COHERE_API_KEY = 'YOUR_API_KEY'
co = cohere.Client(COHERE_API_KEY)

ydl_opts = {
   'format': 'bestaudio/best',
   'postprocessors': [{
       'key': 'FFmpegExtractAudio',
       'preferredcodec': 'mp3',
       'preferredquality': '192',
   }],
   'ffmpeg-location': './',
   'outtmpl': "../assets/uploads/%(id)s.%(ext)s",
}

@app.route("/youtube-mp3", methods=['POST'])
def youtubeMP3():
   # Retrieve POST value
   request_data = request.get_json()
   link = request_data['url']
   _id = link.strip()
   meta = youtube_dl.YoutubeDL(ydl_opts).extract_info(_id)
   save_location = "../assets/uploads/"+meta['id'] + ".mp3"
   # print(save_location)
   data = {
        "status": 200,
        "location": save_location,
        "id": meta['id'],
        "type": "mp3"
    }
   return jsonify(data)

def get_similarity(target: List[float], candidates: List[float], top_k: int):
    candidates = torchfy(candidates).transpose(0, 1)
    target = torchfy(target)
    cos_scores = torch.mm(target, candidates)

    scores, indices = torch.topk(cos_scores, k=top_k)
    similarity_hits = [{'id': idx, 'score': score} for idx, score in zip(indices[0].tolist(), scores[0].tolist())]

    return similarity_hits

@app.route("/")
def hello_world():
    return "Hello World!"

@app.route("/writeText", methods=['POST'])
def writeText():
    # Retrieve POST value
    request_data = request.get_json()
    topic_text = request_data['topic_text']

    # Write text in .txt file
    file_name = str(uuid.uuid4())
    file_ext = 'txt'

    file = open('../assets/uploads/'+file_name + '.' + file_ext, "w")
    file.write(topic_text)
    file.close()

    results = {
        "status": 200,
        "file_name": file_name,
        "file_ext": file_ext
    }
    return jsonify(results)

@app.route("/embedText", methods=['POST'])
def embedText():
    # Retrieve POST value
    request_data = request.get_json()
    file_name = request_data['file_name']
    file_ext = request_data['file_ext']

    # open .txt file
    file = open('../assets/uploads/'+file_name + '.' + file_ext, "r+")
    topic_text = file.read()
    file.close()

    sentences = tokenize.sent_tokenize(topic_text)
    candidates = co.embed(model=model_name, texts=sentences, truncate="RIGHT").embeddings

    results = {
        "status": 200,
        "topic_text": topic_text,
        "sentences": sentences,
        "candidates": candidates
    }
    return jsonify(results)

@app.route("/vectorSearch", methods=['POST'])
def vectorSearch():
    # Retrieve POST value
    request_data = request.get_json()
    question_text = request_data['question_text']
    candidates = request_data['candidates']
    sentences = request_data['sentences']

    candidates_final = np.array(candidates, dtype=np.float32,)

    questionList = question_text.split('\n')

    similar_results = []

    for question in questionList:
        vector_to_search = np.array(co.embed(model=model_name, texts=[question], truncate="RIGHT").embeddings,
        dtype=np.float32,
        )

        result = get_similarity(vector_to_search, candidates=candidates_final, top_k=4)

        similar_result = []
        for index, hit in enumerate(result):
            similar_answer = sentences[hit['id']]
            similar_result.append(similar_answer)

        similar_results.append({'question': question, 'answers': similar_result})

    results = {
        "status": 200,
        "similar_results": similar_results
    }

    return jsonify(results)
#!/usr/bin/env python3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_HTML = os.path.join(BASE_DIR, 'index.html')
CSS_FILE = os.path.join(BASE_DIR, 'css', 'style.css')
JS_DIR = os.path.join(BASE_DIR, 'js')

js_files = [
    'audio.js',
    'config.js',
    'particles.js',
    'turrets.js',
    'zombies.js',
    'bunker.js',
    'survivors.js',
    'engine.js',
    'ui.js',
    'main.js'
]

with open(INDEX_HTML, 'r', encoding='utf-8') as f:
    html = f.read()

with open(CSS_FILE, 'r', encoding='utf-8') as f:
    css_content = f.read()

combined_js = []
for jf in js_files:
    jpath = os.path.join(JS_DIR, jf)
    with open(jpath, 'r', encoding='utf-8') as f:
        combined_js.append(f"// --- {jf} ---\n" + f.read())

all_js = "\n\n".join(combined_js)

# Replace <link rel="stylesheet" href="css/style.css"> with <style>...</style>
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css_content}\n</style>')

# Remove external script tags and append combined script
for jf in js_files:
    html = html.replace(f'<script src="js/{jf}"></script>\n', '')
    html = html.replace(f'<script src="js/{jf}"></script>', '')

html = html.replace('</body>', f'<script>\n{all_js}\n</script>\n</body>')

out_path = '/content/bunker_survival_standalone.html'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Successfully generated standalone single-file game at: {out_path}")

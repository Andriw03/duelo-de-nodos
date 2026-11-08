import pathlib
s=pathlib.Path('src/shell.html').read_text()
for k,f in [('/*CSS*/','style.css'),('/*LOGIC*/','logic.js'),('/*AI*/','ai.js'),('/*UI*/','ui.js')]:
    s=s.replace(k, pathlib.Path('src/'+f).read_text())
pathlib.Path('index.html').write_text(s)
print(len(s),'bytes')

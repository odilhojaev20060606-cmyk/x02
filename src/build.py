import pathlib
d = pathlib.Path(__file__).parent
css = (d/'style.css').read_text(encoding='utf-8')
body = (d/'body.html').read_text(encoding='utf-8')
eng = (d/'engine.js').read_text(encoding='utf-8')
app = (d/'app.js').read_text(encoding='utf-8')
i18n = (d/'i18n.js').read_text(encoding='utf-8')
html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>X02.0</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Golos+Text:wght@400;500;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{eng}
</script>
<script>
{i18n}
</script>
<script>
{app}
</script>
</body>
</html>
'''
(d/'index.html').write_text(html, encoding='utf-8')
print('built', len(html), 'bytes')

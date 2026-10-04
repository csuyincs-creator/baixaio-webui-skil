import wave, struct, math, random, os

os.makedirs('sfx', exist_ok=True)
SR = 44100

def write(name, samples):
    with wave.open('sfx/' + name, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples))

def env(i, n, a=0.01, r=0.6):
    t = i / n
    at = min(1, t / (a + 1e-9))
    rel = min(1, (1 - t) / r + 1e-9)
    return at * rel

# hover: soft sine blip up
n = int(SR * 0.12); s = []
for i in range(n):
    f = 880 + 660 * (i / n)
    s.append(0.18 * env(i, n, 0.05, 0.5) * math.sin(2 * math.pi * f * i / SR))
write('hover.wav', s)

# click: short filtered noise thump
n = int(SR * 0.09); s = []
prev = 0
for i in range(n):
    x = (random.random() * 2 - 1)
    prev = prev * 0.7 + x * 0.3
    e = math.exp(-8 * i / n)
    s.append(0.5 * e * prev + 0.2 * e * math.sin(2 * math.pi * 180 * i / SR))
write('click.wav', s)

# whoosh: band noise swell
n = int(SR * 0.7); s = []
lp = 0
for i in range(n):
    x = random.random() * 2 - 1
    lp = lp * 0.92 + x * 0.08
    t = i / n
    e = math.sin(math.pi * t) ** 1.5
    s.append(0.45 * e * lp)
write('whoosh.wav', s)

# ambient: low warm drone
n = int(SR * 3); s = []
for i in range(n):
    t = i / SR
    wob = 1 + 0.01 * math.sin(2 * math.pi * 0.25 * t)
    v = 0.06 * math.sin(2 * math.pi * 55 * t * wob) + 0.045 * math.sin(2 * math.pi * 110 * t) + 0.02 * math.sin(2 * math.pi * 165 * t)
    s.append(v * min(1, i / (SR * 0.5)) * min(1, (n - i) / (SR * 0.5)))
write('ambient.wav', s)

# ember crackle
n = int(SR * 1.2); s = []
last = -1
for i in range(n):
    v = 0.012 * (random.random() * 2 - 1)
    if random.random() < 0.004:
        last = i
    if last >= 0 and i - last < 90:
        v += 0.35 * math.exp(-0.12 * (i - last)) * (random.random() * 2 - 1)
    s.append(v)
write('ember.wav', s)
print('done', os.listdir('sfx'))

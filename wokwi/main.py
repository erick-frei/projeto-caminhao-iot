import network, time, urequests, ujson
from machine import Pin, time_pulse_us
from config import API_URL, API_KEY, DEVICE_ID

# (id, TRIG, ECHO) de cada compartimento
SENSORES = [("c1", Pin(5, Pin.OUT), Pin(19, Pin.IN)),
            ("c2", Pin(21, Pin.OUT), Pin(22, Pin.IN)),
            ("c3", Pin(25, Pin.OUT), Pin(26, Pin.IN))]
LED = Pin(18, Pin.OUT)
ALTURA = 100.0    # profundidade de cada compartimento (cm), sensor no topo
INTERVALO = 10    # segundos
anterior = {}


def medir(trig, echo):
    trig.value(0); time.sleep_us(2)
    trig.value(1); time.sleep_us(10)
    trig.value(0)
    t = time_pulse_us(echo, 1, 30000)       # tempo de eco em us
    return None if t < 0 else t * 0.0343 / 2   # -> cm


def media(trig, echo):
    v = []
    for _ in range(5):
        d = medir(trig, echo)
        if d is not None and 2 <= d <= ALTURA:  # validação de faixa
            v.append(d)
        time.sleep_ms(50)
    return sum(v) / len(v) if len(v) >= 3 else None


wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("Wokwi-GUEST", "")
while not wlan.isconnected():
    time.sleep(0.2)
print("WIFI OK")

while True:
    comps, alerta = [], False
    for cid, trig, echo in SENSORES:
        d = media(trig, echo)
        if d is None:
            print(cid, "LEITURA INVALIDA")
            continue
        nivel = round((ALTURA - d) / ALTURA * 100, 1)
        queda = cid in anterior and anterior[cid] - nivel >= 5
        anterior[cid] = nivel
        if queda or nivel < 20 or nivel > 95:
            alerta = True
        print(cid, "dist", round(d, 1), "cm | nivel", nivel, "%", "VAZAMENTO" if queda else "")
        comps.append({"id": cid, "level": nivel, "distance_cm": round(d, 1)})
    LED.value(1 if alerta else 0)
    if comps:
        corpo = ujson.dumps({"device_id": DEVICE_ID, "compartments": comps})
        for tentativa in range(3):   # a rede do Wokwi às vezes derruba o TLS
            try:
                r = urequests.post(API_URL, data=corpo,
                    headers={"Content-Type": "application/json",
                             "x-api-key": API_KEY,
                             "Connection": "close"})
                print("ENVIADO", r.status_code)
                r.close()
                break
            except Exception as e:
                print("FALHA", tentativa + 1, e)
                time.sleep(1)
    time.sleep(INTERVALO)

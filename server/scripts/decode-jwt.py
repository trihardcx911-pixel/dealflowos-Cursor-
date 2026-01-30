#!/usr/bin/env python3
import base64, json, os, sys, time
token=os.environ.get("TOKEN","")
p=token.split(".")[1]+"=="
payload=json.loads(base64.urlsafe_b64decode(p))
print(payload)
print("now", int(time.time()), "iat", payload.get("iat"), "exp", payload.get("exp"))

w






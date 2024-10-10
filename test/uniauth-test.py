#!/usr/bin/env python3
# uniauth-test.py

import math
from os import isatty
from struct import *
from socket import *
from sys import stderr, stdin


class Empty(object):
    pass


def command(com,data):
    msg = b""
    if com == "lookup":
      msg += b"\x00"
    elif com == "commit":
        msg += b"\x01"
    elif com == "create":
        msg += b"\x02"
    elif com == "transfer":
        msg += b"\x03"
    else:
        print("bad command",file=stderr)
        return ""

    if com == "transfer":
        if not hasattr(data,"src") or not hasattr(data,"dst"):
            print("missing src or dst for transfer",file=stderr)
            return ""
        msg += b"\x06" + pack(str(len(data.src)+1)+"s",data.src)
        msg += b"\x07" + pack(str(len(data.dst)+1)+"s",data.dst)
    else:
        if not hasattr(data,"key"):
            print("missing key property",file=stderr)
            return ""
        msg += b"\x00" + pack(str(len(data.key)+1)+"s",data.key)
        if hasattr(data,"user"):
            msg += b"\x02" + pack(str(len(data.user)+1)+"s",data.user)
        if hasattr(data,"id"):
            msg += b"\x01" + pack("<i",int(data.id))
        if hasattr(data,"display"):
            msg += b"\x03" + pack(str(len(data.display)+1)+"s",data.display)
        if hasattr(data,"expire"):
            msg += b"\x04" + pack("<q",int(data.expire))
        if hasattr(data,"redirect"):
            msg += b"\x05" + pack(str(len(data.redirect)+1)+"s",data.redirect)
        if hasattr(data,"tag"):
            msg += b"\x08" + pack(str(len(data.tag)+1)+"s",data.tag)
        if hasattr(data,"lifetime"):
            msg += b"\x09" + pack("<i",int(data.lifetime))

    msg += b"\xff"
    return msg


def extract_string(src,it):
    st = it
    while it < len(src) and src[it] != 0:
        it += 1
    return src[st:it].decode("utf-8")


def write_hex(b):
    n = len(b)

    ndigits = max(math.floor(math.log(n,16)) + 1,2)
    addr = 0

    while addr < n:
        slice = b[addr:addr+16]
        bs = []
        for i in range(0,len(slice),2):
            bs.append(slice[i:i+2])

        line = f"0x{{:0>{ndigits}x}}".format(addr) + "  "
        line += "{:─<39}".format(" ".join([b.hex().upper() for b in bs])) + "  "
        line += "".join([chr(b) if chr(b).isprintable() else "·" for b in slice])

        addr += 16
        print(line)


def print_response(response):
    type = response[0]
    if type == 0:
        # message: just read a null terminated string
        print(response[1:len(response)-1])
    elif type == 1:
        # error: functionally this behaves just like message
        print(response[1:len(response)-1])
    elif type == 2:
        # record: parse fields
        i = 1
        while i < len(response):
            field_no = response[i]
            i += 1
            t = "null"
            if field_no == 0:
                t = "string"
                s = "  key: "
            elif field_no == 1:
                t = "int"
                s = "  id: "
            elif field_no == 2:
                t = "string"
                s = "  user: "
            elif field_no == 3:
                t = "string"
                s = "  display: "
            elif field_no == 4:
                t = "long"
                s = "  expire: "
            elif field_no == 5:
                t = "string"
                s = "  redirect: "
            elif field_no == 6:
                t = "string"
                s = "  transsrc: "
            elif field_no == 7:
                t = "string"
                s = "  transdst: "
            elif field_no == 8:
                t = "string"
                s = "  tag: "
            elif field_no == 9:
                t = "int"
                s = "  lifetime: "
            elif field_no == 255:
                break

            if t == "string":
                ss = extract_string(response,i)
                i += len(ss) + 1
                s += ss
            elif t == "int":
                ss = response[i:i+4]
                i += 4
                s += str(unpack("<i",ss)[0])
            elif t == "long":
                ss = response[i:i+8]
                i += 8
                s += str(unpack("<q",ss)[0])

            print(s)


has_tty = isatty(stdin.fileno())
# addr = "\0uniauth"
addr = ("127.0.0.1",7033)
sock_family = AF_INET
sock_type = SOCK_STREAM

sock = socket(sock_family,sock_type)
sock.connect(addr)


while True:
    try:
        if has_tty:
            print("command: ",end="",flush=True)
        com = stdin.readline()
        if len(com) == 0:
            break;
        com = com.strip()

        if has_tty:
            print("fields:")
        data = Empty()
        while True:
            if has_tty:
                print("  -> ",end="",flush=True)
            line = stdin.readline().strip()
            if len(line) == 0:
                break
            parts = list(map(lambda s: s.strip(),line.split(':')))
            if len(parts) != 2:
                if isatty:
                    print("too many parts in field string - try again",file=stderr)
                    continue
                raise Exception("too many parts in field string")

            parts[1] = bytes(parts[1],"utf-8")
            setattr(data,*parts)

        msg = command(com,data)
        if len(msg) == 0:
            continue
        nbytes = sock.send(msg)
        print(f"SEND {nbytes} bytes")
        write_hex(msg)

        response = sock.recv(4096)
        nbytes = len(response)
        print(f"RECV {nbytes} bytes")
        write_hex(response)
        print_response(response)
        print("-" * 80)
    except KeyboardInterrupt:
        break

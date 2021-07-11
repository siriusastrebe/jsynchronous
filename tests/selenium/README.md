# Usage

```node test.js```

# Setup

```npm install selenium-webdriver```

Download webdrivers here:
https://chromedriver.chromium.org/downloads
https://github.com/mozilla/geckodriver/releases

Place them all in the same directory.

You will have to add the to your system path the location of your directory containing your webdriver binaries:

```export PATH=$PATH:<path to webdriver binary>```

## If you run OSX Catalina, you may get errors saying driver cannot be opened because the developer cannot be verified. Run this command on each webdriver:

xattr -d com.apple.quarantine <webdriver file>

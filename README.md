<p align="center"><img src="images/yapix_mark.svg" width="96" alt="Yapix"></p>

# Yapix

Yapix is an API management platform: API docs, a mock server and automated API tests for teams. It is a maintained continuation of [YApi](https://github.com/YMFE/yapi) by YMFE, which has not been updated since November 2022.

> Work in progress. The first release is being prepared.

Goals of the first release:

- security fixes: isolated script sandbox, no default admin password, closed registration by default, current dependencies;
- runs on current Node.js and MongoDB, drop-in for existing YApi databases;
- a client build that works with today's toolchain;
- a Manifest V3 browser extension for in-browser API testing.

## Credits

Yapix is based on YApi by YMFE (Qunar). The original README is kept in [docs/upstream-README.md](docs/upstream-README.md).

## License

Apache License 2.0, like YApi. See [LICENSE](LICENSE).

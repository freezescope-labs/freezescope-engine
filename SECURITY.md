# Security

This is an unaudited testnet review prototype. Do not use its output as recovery authority or an automatic submission gate. For a suspected vulnerability, contact the organization owner privately through GitHub before posting sensitive reproduction data. No staffed security response or guaranteed response time is promised.

The HTTP services bind loopback, restrict Host/Origin, cap JSON input at 1 MiB and use fixed testnet RPC endpoints. They never load a signing key. Only the explicit opt-in pilot script signs disposable testnet transactions with identities kept outside the source checkout. Never put an S-address, production incident secret or private recovery envelope in an imported bundle.

#!/usr/bin/env perl

use strict;
use warnings;
use Plack::Builder;
use Plack::App::GitHubPages::Faux;
builder {
  enable "Headers", set => ["cache-control" => "no-cache"];
  Plack::App::GitHubPages::Faux->new( root => "docs" )->to_app;
};

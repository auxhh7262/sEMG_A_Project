module.exports = {
  "type": "object",
  "properties": {
    "extAppid": {
      "type": "string"
    },
    "extEnable": {
      "type": "boolean"
    },
    "directCommit": {
      "type": "boolean"
    },
    "ext": {
      "type": "object",
      "additionalProperties": {}
    },
    "extPages": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/IPageJSON"
      }
    },
    "__warning__": {
      "type": "string"
    },
    "pages": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "window": {
      "$ref": "#/definitions/IWindow"
    },
    "plugins": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/IPluginConfig"
      }
    },
    "entryPagePath": {
      "type": "string"
    },
    "permission": {
      "type": "object",
      "properties": {
        "scope.userLocation": {
          "type": "object",
          "properties": {
            "desc": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "desc"
          ]
        }
      },
      "additionalProperties": false
    },
    "workers": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "path": {
              "type": "string"
            },
            "isSubpackage": {
              "type": "boolean"
            }
          },
          "additionalProperties": false,
          "required": [
            "isSubpackage",
            "path"
          ]
        },
        {
          "type": "string"
        }
      ]
    },
    "subPackages": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ISubPackageItem"
      }
    },
    "subpackages": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ISubPackageItem"
      }
    },
    "preloadRule": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "network": {
            "enum": [
              "all",
              "wifi"
            ],
            "type": "string"
          },
          "packages": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "additionalProperties": false,
        "required": [
          "packages"
        ]
      }
    },
    "usingComponents": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },
    "componentPlaceholder": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },
    "tabBar": {
      "$ref": "#/definitions/ITabBar"
    },
    "requiredBackgroundModes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "mimeTypeDeclarations": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "networkTimeout": {
      "type": "object",
      "properties": {
        "request": {
          "type": "number"
        },
        "connectSocket": {
          "type": "number"
        },
        "uploadFile": {
          "type": "number"
        },
        "downloadFile": {
          "type": "number"
        }
      },
      "additionalProperties": false
    },
    "debug": {
      "type": "boolean"
    },
    "resizable": {
      "type": "boolean"
    },
    "functionalPages": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "independent": {
              "type": "boolean"
            }
          },
          "additionalProperties": false,
          "required": [
            "independent"
          ]
        },
        {
          "type": "boolean"
        }
      ]
    },
    "cloud": {
      "type": "boolean"
    },
    "openLocationPagePath": {
      "type": "string"
    },
    "sitemapLocation": {
      "type": "string"
    },
    "serviceProviderTicket": {
      "type": "string"
    },
    "style": {
      "const": "v2",
      "type": "string"
    },
    "useExtendedLib": {
      "type": "object",
      "additionalProperties": {
        "type": "boolean"
      }
    },
    "entranceDeclare": {
      "type": "object",
      "properties": {
        "locationMessage": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string"
            },
            "query": {
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "darkmode": {
      "type": "boolean"
    },
    "themeLocation": {
      "type": "string"
    },
    "theme": {
      "type": "string"
    },
    "enablePassiveEvent": {
      "anyOf": [
        {
          "type": "object",
          "additionalProperties": {
            "type": "boolean"
          }
        },
        {
          "type": "boolean"
        }
      ]
    },
    "lazyCodeLoading": {
      "const": "requiredComponents",
      "type": "string"
    },
    "requiredPrivateInfos": {
      "type": "array",
      "items": {
        "enum": [
          "chooseAddress",
          "chooseLocation",
          "choosePoi",
          "getFuzzyLocation",
          "getLocation",
          "onLocationChange",
          "startLocationUpdate",
          "startLocationUpdateBackground"
        ],
        "type": "string"
      }
    }
  },
  "additionalProperties": false,
  "required": [
    "extAppid"
  ],
  "definitions": {
    "IPageJSON": {
      "type": "object",
      "properties": {
        "pageJSONLight": {
          "$ref": "#/definitions/IOriginalPageJSON"
        },
        "pageJSONDark": {
          "$ref": "#/definitions/IOriginalPageJSON"
        },
        "enablePassiveEvent": {
          "anyOf": [
            {
              "type": "object",
              "additionalProperties": {
                "type": "boolean"
              }
            },
            {
              "type": "boolean"
            }
          ]
        },
        "style": {
          "const": "v2",
          "type": "string"
        },
        "componentPlaceholder": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "mini-ios": {
          "$ref": "#/definitions/IOriginalPageJSON"
        },
        "mini-android": {
          "$ref": "#/definitions/IOriginalPageJSON"
        },
        "mini-ohos": {
          "$ref": "#/definitions/IOriginalPageJSON"
        },
        "mini-weixin": {
          "$ref": "#/definitions/IOriginalPageJSON"
        },
        "disableScroll": {
          "type": "boolean"
        },
        "disableSwipeBack": {
          "type": "boolean"
        },
        "usingComponents": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "renderer": {
          "enum": [
            "cover-view",
            "skyline",
            "webview",
            "xr-frame"
          ],
          "type": "string"
        },
        "rendererOptions": {
          "type": "object",
          "properties": {
            "skyline": {
              "additionalProperties": false,
              "type": "object",
              "properties": {
                "disableABTest": {
                  "type": "boolean"
                },
                "sdkVersionBegin": {
                  "type": "string"
                },
                "sdkVersionEnd": {
                  "type": "string"
                },
                "iosVersionBegin": {
                  "type": "string"
                },
                "iosVersionEnd": {
                  "type": "string"
                },
                "androidVersionBegin": {
                  "type": "string"
                },
                "androidVersionEnd": {
                  "type": "string"
                },
                "defaultContentBox": {
                  "type": "boolean"
                },
                "defaultDisplayBlock": {
                  "type": "boolean"
                }
              }
            }
          },
          "additionalProperties": false
        },
        "component": {
          "type": "boolean"
        },
        "componentGenerics": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "default": {
                    "type": "string"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "default"
                ]
              },
              {
                "const": true,
                "type": "boolean"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "singlePage": {
          "type": "object",
          "properties": {
            "navigationBarFit": {
              "enum": [
                "float",
                "squeezed"
              ],
              "type": "string"
            }
          },
          "additionalProperties": false
        },
        "componentFramework": {
          "enum": [
            "exparser",
            "glass-easel"
          ],
          "type": "string"
        },
        "styleIsolation": {
          "enum": [
            "apply-shared",
            "isolated",
            "page-apply-shared",
            "page-isolated",
            "page-shared",
            "shared"
          ],
          "type": "string"
        },
        "pureDataPattern": {
          "type": "string"
        },
        "backgroundColorTop": {
          "type": "string"
        },
        "backgroundColorBottom": {
          "type": "string"
        },
        "backgroundColorContent": {
          "type": "string"
        },
        "backgroundColor": {
          "type": "string"
        },
        "enablePullDownRefresh": {
          "type": "boolean"
        },
        "navigationBarTextStyle": {
          "anyOf": [
            {
              "enum": [
                "black",
                "white"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "navigationBarTitleText": {
          "type": "string"
        },
        "navigationStyle": {
          "enum": [
            "custom",
            "default"
          ],
          "type": "string"
        },
        "backgroundTextStyle": {
          "anyOf": [
            {
              "enum": [
                "dark",
                "light"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "onReachBottomDistance": {
          "type": "number"
        },
        "pageOrientation": {
          "enum": [
            "auto",
            "landscape",
            "portrait"
          ],
          "type": "string"
        },
        "navigationBarBackgroundColor": {
          "type": "string"
        },
        "renderingMode": {
          "enum": [
            "mixed",
            "seperated"
          ],
          "type": "string"
        },
        "restartStrategy": {
          "enum": [
            "homePage",
            "homePageAndLatestPage"
          ],
          "type": "string"
        },
        "visualEffectInBackground": {
          "enum": [
            "hidden",
            "none"
          ],
          "type": "string"
        },
        "initialRenderingCache": {
          "enum": [
            "capture",
            "dynamic",
            "static"
          ],
          "type": "string"
        },
        "handleWebviewPreload": {
          "enum": [
            "auto",
            "manual",
            "static"
          ],
          "type": "string"
        },
        "homeButton": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "IOriginalPageJSON": {
      "type": "object",
      "properties": {
        "disableScroll": {
          "type": "boolean"
        },
        "disableSwipeBack": {
          "type": "boolean"
        },
        "usingComponents": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "renderer": {
          "enum": [
            "cover-view",
            "skyline",
            "webview",
            "xr-frame"
          ],
          "type": "string"
        },
        "rendererOptions": {
          "type": "object",
          "properties": {
            "skyline": {
              "additionalProperties": false,
              "type": "object",
              "properties": {
                "disableABTest": {
                  "type": "boolean"
                },
                "sdkVersionBegin": {
                  "type": "string"
                },
                "sdkVersionEnd": {
                  "type": "string"
                },
                "iosVersionBegin": {
                  "type": "string"
                },
                "iosVersionEnd": {
                  "type": "string"
                },
                "androidVersionBegin": {
                  "type": "string"
                },
                "androidVersionEnd": {
                  "type": "string"
                },
                "defaultContentBox": {
                  "type": "boolean"
                },
                "defaultDisplayBlock": {
                  "type": "boolean"
                }
              }
            }
          },
          "additionalProperties": false
        },
        "component": {
          "type": "boolean"
        },
        "componentGenerics": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "default": {
                    "type": "string"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "default"
                ]
              },
              {
                "const": true,
                "type": "boolean"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "singlePage": {
          "type": "object",
          "properties": {
            "navigationBarFit": {
              "enum": [
                "float",
                "squeezed"
              ],
              "type": "string"
            }
          },
          "additionalProperties": false
        },
        "componentFramework": {
          "enum": [
            "exparser",
            "glass-easel"
          ],
          "type": "string"
        },
        "styleIsolation": {
          "enum": [
            "apply-shared",
            "isolated",
            "page-apply-shared",
            "page-isolated",
            "page-shared",
            "shared"
          ],
          "type": "string"
        },
        "pureDataPattern": {
          "type": "string"
        },
        "backgroundColorTop": {
          "type": "string"
        },
        "backgroundColorBottom": {
          "type": "string"
        },
        "backgroundColorContent": {
          "type": "string"
        },
        "backgroundColor": {
          "type": "string"
        },
        "enablePullDownRefresh": {
          "type": "boolean"
        },
        "navigationBarTextStyle": {
          "anyOf": [
            {
              "enum": [
                "black",
                "white"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "navigationBarTitleText": {
          "type": "string"
        },
        "navigationStyle": {
          "enum": [
            "custom",
            "default"
          ],
          "type": "string"
        },
        "backgroundTextStyle": {
          "anyOf": [
            {
              "enum": [
                "dark",
                "light"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "onReachBottomDistance": {
          "type": "number"
        },
        "pageOrientation": {
          "enum": [
            "auto",
            "landscape",
            "portrait"
          ],
          "type": "string"
        },
        "navigationBarBackgroundColor": {
          "type": "string"
        },
        "renderingMode": {
          "enum": [
            "mixed",
            "seperated"
          ],
          "type": "string"
        },
        "restartStrategy": {
          "enum": [
            "homePage",
            "homePageAndLatestPage"
          ],
          "type": "string"
        },
        "visualEffectInBackground": {
          "enum": [
            "hidden",
            "none"
          ],
          "type": "string"
        },
        "initialRenderingCache": {
          "enum": [
            "capture",
            "dynamic",
            "static"
          ],
          "type": "string"
        },
        "handleWebviewPreload": {
          "enum": [
            "auto",
            "manual",
            "static"
          ],
          "type": "string"
        },
        "homeButton": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "IWindow": {
      "type": "object",
      "properties": {
        "backgroundColorTop": {
          "type": "string"
        },
        "backgroundColorBottom": {
          "type": "string"
        },
        "backgroundColorContent": {
          "type": "string"
        },
        "backgroundColor": {
          "type": "string"
        },
        "enablePullDownRefresh": {
          "type": "boolean"
        },
        "navigationBarTextStyle": {
          "anyOf": [
            {
              "enum": [
                "black",
                "white"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "navigationBarTitleText": {
          "type": "string"
        },
        "navigationStyle": {
          "enum": [
            "custom",
            "default"
          ],
          "type": "string"
        },
        "backgroundTextStyle": {
          "anyOf": [
            {
              "enum": [
                "dark",
                "light"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "onReachBottomDistance": {
          "type": "number"
        },
        "pageOrientation": {
          "enum": [
            "auto",
            "landscape",
            "portrait"
          ],
          "type": "string"
        },
        "navigationBarBackgroundColor": {
          "type": "string"
        },
        "renderingMode": {
          "enum": [
            "mixed",
            "seperated"
          ],
          "type": "string"
        },
        "restartStrategy": {
          "enum": [
            "homePage",
            "homePageAndLatestPage"
          ],
          "type": "string"
        },
        "visualEffectInBackground": {
          "enum": [
            "hidden",
            "none"
          ],
          "type": "string"
        },
        "initialRenderingCache": {
          "enum": [
            "capture",
            "dynamic",
            "static"
          ],
          "type": "string"
        },
        "handleWebviewPreload": {
          "enum": [
            "auto",
            "manual",
            "static"
          ],
          "type": "string"
        },
        "homeButton": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "IPluginConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "type": "string"
        },
        "version": {
          "type": "string"
        },
        "path": {
          "type": "string"
        },
        "export": {
          "type": "string"
        },
        "genericsImplementation": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "provider",
        "version"
      ]
    },
    "ISubPackageItem": {
      "type": "object",
      "properties": {
        "independent": {
          "type": "boolean"
        },
        "name": {
          "type": "string"
        },
        "entry": {
          "type": "string"
        },
        "root": {
          "type": "string"
        },
        "pages": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "plugins": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/IPluginConfig"
          }
        },
        "useExtendedLib": {
          "type": "object",
          "additionalProperties": {
            "type": [
              "string",
              "boolean"
            ]
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "pages",
        "root"
      ]
    },
    "ITabBar": {
      "type": "object",
      "properties": {
        "custom": {
          "type": "boolean"
        },
        "list": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "pagePath": {
                "type": "string"
              },
              "text": {
                "type": "string"
              },
              "iconPath": {
                "type": "string"
              },
              "selectedIconPath": {
                "type": "string"
              },
              "renderer": {
                "enum": [
                  "cover-view",
                  "skyline",
                  "webview"
                ],
                "type": "string"
              }
            },
            "additionalProperties": false,
            "required": [
              "pagePath"
            ]
          }
        },
        "borderStyle": {
          "anyOf": [
            {
              "enum": [
                "black",
                "white"
              ],
              "type": "string"
            },
            {
              "type": "string",
              "pattern": "^@.*$"
            }
          ]
        },
        "position": {
          "enum": [
            "bottom",
            "top"
          ],
          "type": "string"
        },
        "color": {
          "type": "string"
        },
        "selectedColor": {
          "type": "string"
        },
        "backgroundColor": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "list"
      ]
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$version": 1745561918360
}
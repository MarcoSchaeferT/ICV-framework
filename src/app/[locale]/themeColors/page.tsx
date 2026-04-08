

//import { useState, useEffect } from 'react'
import React, { type JSX } from "react";
import { consts } from "../../const_store";
import { Button } from "@/components/ui/button"
import config from "../../../../tailwind.config";

export default async function Home(): Promise<JSX.Element> {
    
    function flattenColors (colorObj: any)  {
        const flatColors: { [key: string]: string } = {};
        for (const color in colorObj) {
            console.log("color:", color);
          if (typeof colorObj[color] === "object" && "default" in colorObj[color]) {
            flatColors[color] = colorObj[color].default;
            flatColors[color.slice(0, 3)+"-dark"] = colorObj[color].dark;
            flatColors[color.slice(0, 3)+"-light"] = colorObj[color].light;
            flatColors[color.slice(0, 3)+"-foreground"] = colorObj[color].foreground;
          } else {
            flatColors[color] = colorObj[color];
            flatColors[color.split("")[0]+"-placeholder"] = colorObj[color];
          }
        }
        return flatColors;
      };

      // Flatten colors for easier access
    const flatColors =  flattenColors(config.theme?.extend?.colors ?? {});
    const flatColorsDark = flattenColors(config.theme?.extend?.darkColors ?? {});
    console.log("flatColors:", flatColors);
    return (
        <>
            <main className="flex min-h-screen flex-col items-center justify-between p-24">
                 <table>
                    <thead></thead>
                    <tbody>
                        <tr><td>light colors:
                        <div className="grid grid-cols-4 gap-1 p-1">
                        {Object.keys(flatColors).map((color, index) => {
                        return (
                                <div key={index}>
                                    <small>{color.charAt(0).toUpperCase() + color.slice(1)}</small>
                                    <br />
                                    <Button
                                        className="text-gray-800 w-[125px] h-[75x]"
                                        style={{ backgroundColor: flatColors[color], border: "none" }}
                                    >
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        <br />
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        <br />
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                    </Button>
                                </div>
                        
                        );  })}
                    </div>
                    </td>
                    <td>dark colors:
                    <div className="grid grid-cols-4 gap-1 p-1">
                        {Object.keys(flatColorsDark).map((color, index) => {
                        return (
                            <React.Fragment key={index}>
                                <div>
                                    <small>{color.charAt(0).toUpperCase() + color.slice(1)}</small>
                                    <br />
                                    <Button
                                        className="text-gray-800 w-[125px] h-[75x]"
                                        style={{ backgroundColor: flatColorsDark[color], border: "none" }}
                                    >
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        <br />
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        <br />
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                    </Button>
                                </div>
                            </React.Fragment>
                        );  
                        
                        })}

                    </div>
                    </td></tr>
                    </tbody>
                </table>
            </main>
        </>
    );
}
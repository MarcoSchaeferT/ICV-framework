'use client'

import { JSX, useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, Icon, Pin, Hand, } from 'lucide-react'
import {LINK} from '../../../../messages/navbarContent'
import { cn } from "@/lib/utils"
//import Link from "next/link"
import {Link} from '@/i18n/routing';
import { layoutSizes } from '@/app/const_store'
import Checkbox_isSwapy from './isSwapyHandle'
import { useUIContext } from '../contexts/UIContext'

interface nav {
    navLinks: LINK[];
    isOpen: boolean;
}


export default function NavbarLeft(props: nav): JSX.Element  {
  const [isOpen, setIsOpen] = useState(false)
  const [isPin, setIsPin] = useState(false)

  let c = useUIContext();

  return (
    <>
    <nav
      className="fixed left-0 top-0 h-full bg-secondary-dark z-1400"
      onMouseEnter={() => !isPin ? setIsOpen(true) : null}
      onMouseLeave={() => !isPin ? setIsOpen(false) : null}
    >
      <motion.div
        {...{
          className: cn(
            "h-full p-4 flex flex-col items-start"
          ),
          animate: { width: isOpen || isPin ? 256 : layoutSizes.leftNavbarWidth },
          transition: { duration: 0.3 }
        }}
      >
        <div className="mb-8 flex items-center">
          <Menu className="h-8 w-8 ml-0 text-white" onClick={() => { setIsPin((cur) => !cur); setIsOpen(true); }} />
        </div>
        {props.navLinks.map((item: LINK, index) => {
            const IconComponent = item.icon;
            return (
              <motion.button
                key={index}
                {...{
                  className: `flex items-center w-full p-2 mb-4 rounded-lg hover:bg-accent ${isOpen || isPin ? "justify-start" : "justify-center"}`,
                  whileHover: { scale: 1.05 },
                  whileTap: { scale: 0.95 },
                }}
              >
                {IconComponent ? (
                  <IconComponent className="h-12 w-6 mr-0 text-white" />
                ) : null}
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    {...{
                      className: "text-sm font-medium text-white"
                    }}
                  >
                    <Link
                      href={item.href}
                      className=" w-5 items-center gap-x-2 p-1 ml-2 hover:text-amber-500 text-sm"
                    >
                      {item.title}
                    </Link>
                  </motion.span>
                )}
              </motion.button>
            );
        })}
        
         <div className="mt-auto">
           <div className="bottom-16 mb-2   text-white group">
       <Checkbox_isSwapy />
    </div>
          <motion.button
          {...{
            className:cn(
              "flex items-center w-full p-2 rounded-lg hover:bg-accent",
              isOpen ? "justify-start" : "justify-center"
            ),
            whileHover: { scale: 1.05 },
            whileTap: { scale: 0.95 },
            onClick: () => { setIsPin((cur) => !cur); setIsOpen(true); }} 
          }
          >
            <motion.div animate={{ rotate: isPin ? 90 : 0, translateY: isPin? 2 : 0, translateX: -6 }}>
              <Pin className={cn("text-white content-end h-6 w-6 mr-2")} />
            </motion.div>
            {isOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                {...{
                className: "text-sm font-medium text-white"
              }}
              >
                Pin
              </motion.span>
            )}
          </motion.button>
        </div>
      </motion.div>
    </nav>
    </>
  )
}